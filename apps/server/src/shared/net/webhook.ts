import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';

/**
 * Outbound webhooks go to URLs that users type in, so every request is guarded
 * against SSRF (server-side request forgery):
 *
 * - only `https:` URLs without embedded credentials
 * - the target IP must be public: loopback, private, link-local (cloud metadata),
 *   CGNAT, multicast and reserved ranges are refused
 * - the check runs inside the socket's DNS lookup, so the address we validate is
 *   the address we connect to (no DNS-rebinding window)
 * - redirects are never followed and the whole request has a timeout
 */

export const WEBHOOK_TIMEOUT_MS = 5_000;

export class UnsafeWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeWebhookError';
  }
}

const blocked = new net.BlockList();
for (const [prefix, bits] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata (169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(prefix, bits, 'ipv4');
}
for (const [prefix, bits] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64, can reach internal IPv4
  ['100::', 64], // discard
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, can wrap internal IPv4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(prefix, bits, 'ipv6');
}

/** True if `address` (IPv4 or IPv6 literal) must never be called. Non-IP input counts as blocked. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) {
    // IPv4-mapped IPv6 (::ffff:10.0.0.1 or ::ffff:a00:1) is checked as the IPv4 it wraps.
    const mapped = /^::ffff:(.+)$/i.exec(address);
    if (mapped) {
      const tail = mapped[1];
      if (net.isIPv4(tail)) return isBlockedAddress(tail);
      const hex = tail.split(':');
      if (hex.length === 2) {
        const n = (parseInt(hex[0], 16) << 16) | parseInt(hex[1], 16);
        return isBlockedAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
      }
      return true;
    }
    return blocked.check(address, 'ipv6');
  }
  return true;
}

/** Validates the URL shape. Throws `UnsafeWebhookError`; returns the parsed URL. */
export function assertSafeWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeWebhookError('Webhook URL is not a valid URL');
  }
  if (url.protocol !== 'https:') throw new UnsafeWebhookError('Webhook URL must use https');
  if (url.username || url.password) throw new UnsafeWebhookError('Webhook URL must not contain credentials');

  // URL keeps IPv6 literals in brackets: [::1]
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  if (!host) throw new UnsafeWebhookError('Webhook URL has no host');
  // An IP literal never goes through DNS lookup, so check it here.
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new UnsafeWebhookError(`Webhook host ${host} is not a public address`);
  }
  return url;
}

type LookupFn = typeof dns.lookup;

/**
 * Wraps a DNS lookup so that a hostname resolving to any non-public address fails the
 * connection. Handles both the single-address and `all: true` callback shapes Node uses.
 */
export function guardedLookup(base: LookupFn = dns.lookup): LookupFn {
  const lookup = (hostname: string, options: dns.LookupOptions, callback: (...args: any[]) => void) => {
    base(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = addresses as dns.LookupAddress[];
      const bad = list.find((a) => isBlockedAddress(a.address));
      if (bad || list.length === 0) {
        return callback(new UnsafeWebhookError(`Webhook host ${hostname} resolves to a non-public address`));
      }
      if (options.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
  return lookup as unknown as LookupFn;
}

export interface WebhookDeps {
  request: typeof https.request;
  lookup: LookupFn;
  timeoutMs: number;
}

const defaultDeps: WebhookDeps = { request: https.request, lookup: dns.lookup, timeoutMs: WEBHOOK_TIMEOUT_MS };

/**
 * POSTs `payload` as JSON to a user-supplied webhook URL with the SSRF guards above.
 * Resolves on 2xx; rejects on anything else, including redirects.
 */
export function sendWebhook(rawUrl: string, payload: unknown, deps: Partial<WebhookDeps> = {}): Promise<number> {
  const { request, lookup, timeoutMs } = { ...defaultDeps, ...deps };
  let url: URL;
  try {
    url = assertSafeWebhookUrl(rawUrl);
  } catch (err) {
    return Promise.reject(err);
  }
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'user-agent': 'ApexMonitor-Webhook/1.0',
        },
        lookup: guardedLookup(lookup),
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        res.resume(); // discard the body; we only care about the status
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) resolve(status);
        else reject(new Error(`Webhook responded with HTTP ${status}${status >= 300 && status < 400 ? ' (redirects are not followed)' : ''}`));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

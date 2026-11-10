import { EventEmitter } from 'node:events';
import type dns from 'node:dns';
import { describe, expect, it, vi } from 'vitest';
import {
  UnsafeWebhookError,
  assertSafeWebhookUrl,
  guardedLookup,
  isBlockedAddress,
  sendWebhook,
} from '@shared/net/webhook';

type Addr = dns.LookupAddress;

/** A fake dns.lookup that always answers with `addresses`. */
const fakeDns = (addresses: Addr[] | Error) =>
  ((_host: string, _opts: unknown, cb: (err: Error | null, a?: Addr[]) => void) => {
    if (addresses instanceof Error) cb(addresses);
    else cb(null, addresses);
  }) as unknown as typeof dns.lookup;

/** Runs a guarded lookup and returns what the socket would receive. */
function resolveVia(addresses: Addr[] | Error, all = false) {
  return new Promise<{ err: Error | null; result: unknown[] }>((resolve) => {
    guardedLookup(fakeDns(addresses))('hooks.example', { all } as dns.LookupOptions, ((err: Error | null, ...result: unknown[]) =>
      resolve({ err, result })) as never);
  });
}

/**
 * A fake https.request: records options, runs the socket's lookup like Node would,
 * and answers with `status` only if the lookup succeeded.
 */
function fakeRequest(status: number, dnsAnswer: Addr[] = [{ address: '93.184.216.34', family: 4 }]) {
  const calls: { url: URL; options: any; body: string }[] = [];
  const request = vi.fn((url: URL, options: any, onResponse: (res: any) => void) => {
    const req = new EventEmitter() as EventEmitter & { end(body: string): void };
    req.end = (body: string) => {
      calls.push({ url, options, body });
      options.lookup(url.hostname, {}, (err: Error | null) => {
        if (err) return req.emit('error', err);
        const res = Object.assign(new EventEmitter(), { statusCode: status, resume: vi.fn() });
        onResponse(res);
      });
    };
    return req;
  });
  return { request: request as never, calls, lookup: fakeDns(dnsAnswer) };
}

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '127.255.255.254', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc00::1', 'ff02::1', '64:ff9b::a00:1', '2002:a00:1::',
    '::ffff:127.0.0.1', '::ffff:a00:1', '::ffff:a9fe:a9fe', 'not-an-ip', '',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'allows public %s',
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe('assertSafeWebhookUrl', () => {
  it('accepts a public https URL', () => {
    expect(assertSafeWebhookUrl('https://hooks.slack.com/services/T/B/x').hostname).toBe('hooks.slack.com');
  });

  it.each([
    ['http://hooks.example/x', 'https'],
    ['ftp://hooks.example/x', 'https'],
    ['file:///etc/passwd', 'https'],
    ['not a url', 'valid URL'],
    ['https://user:pass@hooks.example/x', 'credentials'],
    ['https://127.0.0.1/x', 'not a public'],
    ['https://169.254.169.254/latest/meta-data', 'not a public'],
    ['https://[::1]:8443/x', 'not a public'],
    ['https://[::ffff:10.0.0.1]/x', 'not a public'],
    ['https://0x7f000001/x', 'not a public'], // WHATWG URL normalises hex/octal/decimal IPv4 forms
    ['https://2130706433/x', 'not a public'],
    ['https://017700000001/x', 'not a public'],
  ])('rejects %s', (url, reason) => {
    expect(() => assertSafeWebhookUrl(url)).toThrow(UnsafeWebhookError);
    expect(() => assertSafeWebhookUrl(url)).toThrow(reason);
  });
});

describe('guardedLookup', () => {
  it('passes public addresses through in both callback shapes', async () => {
    const single = await resolveVia([{ address: '93.184.216.34', family: 4 }]);
    expect(single).toEqual({ err: null, result: ['93.184.216.34', 4] });
    const all = await resolveVia([{ address: '93.184.216.34', family: 4 }, { address: '2606:4700::1', family: 6 }], true);
    expect(all.err).toBeNull();
    expect(all.result[0]).toHaveLength(2);
  });

  it('fails when any resolved address is internal (DNS rebinding / split answers)', async () => {
    const { err } = await resolveVia([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    expect(err).toBeInstanceOf(UnsafeWebhookError);
    expect((await resolveVia([{ address: '127.0.0.1', family: 4 }])).err).toBeInstanceOf(UnsafeWebhookError);
  });

  it('fails on an empty answer and passes DNS errors through', async () => {
    expect((await resolveVia([])).err).toBeInstanceOf(UnsafeWebhookError);
    const dnsErr = new Error('ENOTFOUND');
    expect((await resolveVia(dnsErr)).err).toBe(dnsErr);
  });
});

describe('sendWebhook', () => {
  it('POSTs JSON with a guarded lookup and a timeout, resolving on 2xx', async () => {
    const fake = fakeRequest(204);
    await expect(sendWebhook('https://hooks.example/x', { text: 'hi' }, fake)).resolves.toBe(204);
    const [{ url, options, body }] = fake.calls;
    expect(url.href).toBe('https://hooks.example/x');
    expect(options.method).toBe('POST');
    expect(options.headers['content-type']).toBe('application/json');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(typeof options.lookup).toBe('function');
    expect(JSON.parse(body)).toEqual({ text: 'hi' });
  });

  it('refuses unsafe URLs without opening a connection', async () => {
    const fake = fakeRequest(200);
    for (const url of ['http://hooks.example/x', 'https://169.254.169.254/', 'https://[::1]/', 'https://user:pw@hooks.example/']) {
      await expect(sendWebhook(url, {}, fake)).rejects.toBeInstanceOf(UnsafeWebhookError);
    }
    expect(fake.request).not.toHaveBeenCalled();
  });

  it('refuses a hostname that resolves to an internal address', async () => {
    const fake = fakeRequest(200, [{ address: '169.254.169.254', family: 4 }]);
    await expect(sendWebhook('https://metadata.attacker.example/', {}, fake)).rejects.toThrow('non-public address');
  });

  it('does not follow redirects and rejects non-2xx responses', async () => {
    await expect(sendWebhook('https://hooks.example/x', {}, fakeRequest(302))).rejects.toThrow('redirects are not followed');
    await expect(sendWebhook('https://hooks.example/x', {}, fakeRequest(500))).rejects.toThrow('HTTP 500');
  });

  it('aborts a request that exceeds the timeout', async () => {
    // A request that never answers: the abort signal must fire.
    const request = vi.fn((_u: URL, options: any) => {
      const req = new EventEmitter() as EventEmitter & { end(): void };
      req.end = () => options.signal.addEventListener('abort', () => req.emit('error', options.signal.reason));
      return req;
    });
    await expect(
      sendWebhook('https://hooks.example/x', {}, { request: request as never, lookup: fakeDns([]), timeoutMs: 20 }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

import crypto from 'crypto';
import { config, isBillingEnabled } from '@config';

/** Pay API per PHONEPE_ENV. */
export const PHONEPE_PAY_URLS = {
  sandbox: 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay',
  production: 'https://api.phonepe.com/apis/hermes/pg/v1/pay',
} as const;

/** Credentials from config; throws BILLING_NOT_CONFIGURED when billing is off. */
function credentials() {
  if (!isBillingEnabled()) throw new Error('BILLING_NOT_CONFIGURED');
  return {
    merchantId: config.PHONEPE_MERCHANT_ID as string,
    saltKey: config.PHONEPE_SALT_KEY as string,
    saltIndex: String(config.PHONEPE_SALT_INDEX),
    payUrl: PHONEPE_PAY_URLS[config.PHONEPE_ENV],
  };
}

export class PhonePeUtils {
  /** Unique per checkout, 33 chars (PhonePe allows up to 38). The webhook looks the user up by this id. */
  static newMerchantTransactionId(): string {
    return `TX_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Stable, opaque id PhonePe uses to group a customer's payments. It is never mapped back
   * to a user: our user ids (36 chars) don't fit PhonePe's limit, and the webhook finds the
   * user through `billing_checkouts` instead.
   */
  static merchantUserIdFor(userId: string): string {
    return `MU${crypto.createHash('sha256').update(userId).digest('hex').slice(0, 30)}`;
  }

  static generateCheckoutPayload(merchantTransactionId: string, userId: string, amountInPaise: number, redirectUrl: string) {
    const { merchantId, saltKey, saltIndex, payUrl } = credentials();
    const payload = {
      merchantId,
      merchantTransactionId,
      merchantUserId: PhonePeUtils.merchantUserIdFor(userId),
      amount: amountInPaise, 
      redirectUrl: redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: `${config.API_BASE_URL}/api/v1/billing/webhook/phonepe`,
      mobileNumber: '9999999999',
      paymentInstrument: { type: 'PAY_PAGE' }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // Generate X-VERIFY Checksum
    const stringToHash = base64Payload + '/pg/v1/pay' + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = `${sha256}###${saltIndex}`;

    return { base64Payload, checksum, merchantTransactionId, merchantId, url: payUrl };
  }

  static verifyWebhookSignature(base64Response: string, xVerifyHeader: string): boolean {
    const { saltKey, saltIndex } = credentials();
    const expectedSha256 = crypto.createHash('sha256').update(base64Response + saltKey).digest('hex');
    const expected = Buffer.from(`${expectedSha256}###${saltIndex}`);
    const given = Buffer.from(String(xVerifyHeader));
    // constant-time comparison so the signature can't be guessed byte by byte
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  }
}
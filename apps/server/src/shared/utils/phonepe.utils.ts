import crypto from 'crypto';
import { config } from '@config'; // Assume you added PHONEPE variables to your config

// For Sandbox/UAT testing, PhonePe provides these default credentials:
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
const SALT_KEY = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const PHONEPE_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

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
    const payload = {
      merchantId: MERCHANT_ID,
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
    const stringToHash = base64Payload + '/pg/v1/pay' + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = `${sha256}###${SALT_INDEX}`;

    return { base64Payload, checksum, merchantTransactionId, url: PHONEPE_URL };
  }

  static verifyWebhookSignature(base64Response: string, xVerifyHeader: string): boolean {
    const stringToHash = base64Response + SALT_KEY;
    const expectedSha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const expectedChecksum = `${expectedSha256}###${SALT_INDEX}`;
    
    return xVerifyHeader === expectedChecksum;
  }
}
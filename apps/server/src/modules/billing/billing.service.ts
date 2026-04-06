import { getPg } from '@infrastructure/db/postgres';
import { getRedis } from '@infrastructure/redis';
import { PhonePeUtils } from '@shared/utils/phonepe.utils';

export class BillingService {
  private get db() { return getPg(); }

  async createCheckoutSession(userId: string) {
    // PRO Plan costs ₹2999/month -> 299900 Paise
    const amountInPaise = 299900; 
    // In production, this would be your frontend Next.js URL
    const redirectUrl = `http://localhost:3000/dashboard/billing?status=success`; 

    const { base64Payload, checksum, url } = PhonePeUtils.generateCheckoutPayload(userId, amountInPaise, redirectUrl);

    // Call PhonePe S2S API to get the payment page URL
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': 'PGTESTPAYUAT' // Sandbox Merchant ID
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data.instrumentResponse.redirectInfo.url;
    } else {
      throw new Error(`PhonePe Checkout Failed: ${result.message}`);
    }
  }

  async handlePhonePeWebhook(base64Response: string, xVerifyHeader: string) {
    const isValid = PhonePeUtils.verifyWebhookSignature(base64Response, xVerifyHeader);
    if (!isValid) throw new Error('INVALID_SIGNATURE');

    const decodedPayload = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
    
    if (decodedPayload.code === 'PAYMENT_SUCCESS') {
      const userId = decodedPayload.data.merchantUserId;
      const txId = decodedPayload.data.merchantTransactionId;

      // 1. Upgrade User to PRO in DB
      await this.db.query(
        `INSERT INTO subscriptions (user_id, plan_tier, last_tx_id, payment_status) 
         VALUES ($1, 'PRO', $2, 'SUCCESS')
         ON CONFLICT (user_id) DO UPDATE SET 
         plan_tier = 'PRO', last_tx_id = $2, payment_status = 'SUCCESS', updated_at = NOW()`,
        [userId, txId]
      );

      // 2. Clear Redis cache so the IngestService instantly applies new limits
      const redis = getRedis();
      await redis.del(`tier:${userId}`);
      
      console.log(`💰 [Billing] User ${userId} upgraded to PRO tier!`);
    }
  }
}
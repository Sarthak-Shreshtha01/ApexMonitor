import { getPg } from '@infrastructure/db/postgres';
import { getRedis } from '@infrastructure/redis';
import { PhonePeUtils } from '@shared/utils/phonepe.utils';
import { config, isBillingEnabled } from '@config';

/** PRO plan: ₹2999/month. */
export const PRO_PLAN = { tier: 'PRO', amountPaise: 299900 } as const;

type WebhookOutcome = 'upgraded' | 'failed' | 'ignored';

export class BillingService {
  private get db() { return getPg(); }

  async createCheckoutSession(userId: string) {
    // Fail before recording anything if billing is off.
    if (!isBillingEnabled()) throw new Error('BILLING_NOT_CONFIGURED');

    // Record who is paying *before* sending them to PhonePe. The webhook later finds the
    // user from this row by merchantTransactionId (KI-36).
    const merchantTransactionId = PhonePeUtils.newMerchantTransactionId();
    await this.db.query(
      `INSERT INTO billing_checkouts (merchant_transaction_id, user_id, plan_tier, amount_paise)
       VALUES ($1, $2, $3, $4)`,
      [merchantTransactionId, userId, PRO_PLAN.tier, PRO_PLAN.amountPaise]
    );

    // PhonePe sends the customer back here; the webhook decides whether the payment succeeded.
    const redirectUrl = `${config.FRONTEND_URL}/billing?checkout=${encodeURIComponent(merchantTransactionId)}`;
    const { base64Payload, checksum, merchantId, url } = PhonePeUtils.generateCheckoutPayload(merchantTransactionId, userId, PRO_PLAN.amountPaise, redirectUrl);

    // Call PhonePe S2S API to get the payment page URL
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchantId,
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data.instrumentResponse.redirectInfo.url;
    }

    await this.markCheckout(merchantTransactionId, 'FAILED', 'CHECKOUT_REJECTED');
    throw new Error(`PhonePe Checkout Failed: ${result.message}`);
  }

  async handlePhonePeWebhook(base64Response: string, xVerifyHeader: string): Promise<WebhookOutcome> {
    const isValid = PhonePeUtils.verifyWebhookSignature(base64Response, xVerifyHeader);
    if (!isValid) throw new Error('INVALID_SIGNATURE');

    let decodedPayload: { code?: unknown; data?: { merchantTransactionId?: unknown; amount?: unknown } };
    try {
      decodedPayload = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
    } catch {
      throw new Error('INVALID_WEBHOOK_PAYLOAD');
    }
    const code = String(decodedPayload.code ?? '');
    const txId = decodedPayload.data?.merchantTransactionId;
    if (typeof txId !== 'string' || !txId) {
      console.warn(`[Billing] Webhook ${code} without merchantTransactionId ignored`);
      return 'ignored';
    }

    if (code === 'PAYMENT_SUCCESS') {
      // One statement, so it is atomic: complete the checkout only if it is still pending
      // and the paid amount matches what we asked for, then upgrade *that checkout's* user.
      // Replayed webhooks find no pending row and change nothing.
      const { rows } = await this.db.query(
        `WITH done AS (
           UPDATE billing_checkouts
              SET status = 'SUCCESS', gateway_code = $2, completed_at = NOW()
            WHERE merchant_transaction_id = $1 AND status = 'PENDING' AND amount_paise = $3
        RETURNING user_id, plan_tier, merchant_transaction_id
         )
         INSERT INTO subscriptions (user_id, plan_tier, last_tx_id, payment_status)
         SELECT user_id, plan_tier, merchant_transaction_id, 'SUCCESS' FROM done
         ON CONFLICT (user_id) DO UPDATE SET
           plan_tier = EXCLUDED.plan_tier, last_tx_id = EXCLUDED.last_tx_id,
           payment_status = 'SUCCESS', updated_at = NOW()
         RETURNING user_id`,
        [txId, code, Number(decodedPayload.data?.amount)]
      );

      const userId: string | undefined = rows[0]?.user_id;
      if (!userId) {
        console.warn(`[Billing] PAYMENT_SUCCESS for ${txId} not applied (unknown, already processed, or amount mismatch)`);
        return 'ignored';
      }

      // Clear Redis cache so the IngestService instantly applies new limits
      await getRedis().del(`tier:${userId}`);
      console.log(`💰 [Billing] User ${userId} upgraded to PRO tier!`);
      return 'upgraded';
    }

    // Still in progress: wait for the final callback.
    if (code === 'PAYMENT_PENDING') return 'ignored';

    await this.markCheckout(txId, 'FAILED', code || 'UNKNOWN');
    return 'failed';
  }

  private async markCheckout(merchantTransactionId: string, status: 'FAILED', gatewayCode: string) {
    await this.db.query(
      `UPDATE billing_checkouts SET status = $2, gateway_code = $3, completed_at = NOW()
        WHERE merchant_transaction_id = $1 AND status = 'PENDING'`,
      [merchantTransactionId, status, gatewayCode.slice(0, 64)]
    );
  }
}

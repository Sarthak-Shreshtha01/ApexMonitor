import { Request, Response, NextFunction } from 'express';
import { BillingService } from './billing.service';

export class BillingController {
  private service = new BillingService();

  public checkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id; 
      const paymentUrl = await this.service.createCheckoutSession(userId);
      res.status(200).json({ url: paymentUrl });
    } catch (error: any) {
      // NEW: Log it to terminal and send it to curl
      console.error('❌ [Checkout Error]', error.message);
      res.status(500).json({ error: error.message }); 
    }
  };

  public webhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const xVerify = req.headers['x-verify'] as string;
      const { response } = req.body; // PhonePe sends a base64 string inside the 'response' key
      
      if (!xVerify || !response) return res.status(400).send();

      await this.service.handlePhonePeWebhook(response, xVerify);
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ [Webhook Error]', error);
      res.status(400).send('Webhook Failed');
    }
  };
}
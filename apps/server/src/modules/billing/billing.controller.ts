import { Request, Response, NextFunction } from 'express';
import { BillingService } from './billing.service';
import { errorBody, successBody } from '@shared/http/api-contract';

export class BillingController {
  private service = new BillingService();

  public checkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const paymentUrl = await this.service.createCheckoutSession(userId);
      res.status(200).json(successBody(res, { url: paymentUrl }));
    } catch (error) {
      next(error);
    }
  };

  public webhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const xVerify = req.headers['x-verify'] as string;
      const { response } = req.body; // PhonePe sends a base64 string inside the 'response' key
      
      if (!xVerify || !response) {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'Missing webhook signature or payload'));
        return;
      }

      await this.service.handlePhonePeWebhook(response, xVerify);
      
      res.status(200).json(successBody(res, { ok: true }));
    } catch (error) {
      next(error);
    }
  };
}
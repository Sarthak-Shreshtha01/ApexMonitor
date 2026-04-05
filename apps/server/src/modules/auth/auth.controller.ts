import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  private service = new AuthService();

  public generateKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, label } = req.body;
      
      // In a full implementation, we'd verify the requesting user has 'admin' rights to this project
      const plaintextKey = await this.service.generateApiKey(projectId, label);
      
      res.status(201).json({ 
        message: 'Store this key securely. It will not be shown again.',
        key: plaintextKey 
      });
    } catch (error) {
      next(error);
    }
  };
}
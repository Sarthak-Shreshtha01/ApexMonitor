import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { RegisterDto, LoginDto } from './dto/user.dto';

export class UserController {
  private service = new UserService();

  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = RegisterDto.parse(req.body);
      const result = await this.service.register(data);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'EMAIL_IN_USE') return res.status(409).json({ error: error.message });
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = LoginDto.parse(req.body);
      const result = await this.service.login(data);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: error.message });
      next(error);
    }
  };
}
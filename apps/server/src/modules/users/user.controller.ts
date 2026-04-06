import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { RegisterDto, LoginDto } from './dto/user.dto';
import { serializeCookie } from '@shared/utils/cookie.utils';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.setHeader('Set-Cookie', [
    serializeCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
    }),
  ]);

  res.setHeader('X-Access-Token', accessToken);
}

function clearAuthCookies(res: Response): void {
  res.setHeader('Set-Cookie', [
    serializeCookie('refresh_token', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAgeSeconds: 0,
    }),
  ]);
}

export class UserController {
  private service = new UserService();

  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = RegisterDto.parse(req.body);
      const result = await this.service.register(data);
      setAuthCookies(res, result.accessToken, result.refreshToken);
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
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: error.message });
      next(error);
    }
  };

  public logout = async (_req: Request, res: Response): Promise<void> => {
    clearAuthCookies(res);
    res.status(204).send();
  };
}
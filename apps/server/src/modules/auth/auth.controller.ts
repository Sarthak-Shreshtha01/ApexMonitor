import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { parseCookieHeader, serializeCookie } from '@shared/utils/cookie.utils';

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

export class AuthController {
  private service = new AuthService();

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await this.service.login(email, password);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
        return;
      }

      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = parseCookieHeader(req.headers.cookie);
      const refreshToken = cookies.refresh_token;

      if (!refreshToken) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing refresh token' });
        return;
      }

      const result = await this.service.refreshSession(refreshToken);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json({ accessToken: result.accessToken });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid refresh token' });
        return;
      }

      next(error);
    }
  };

  public logout = async (_req: Request, res: Response): Promise<void> => {
    clearAuthCookies(res);
    res.status(204).send();
  };

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
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { parseCookieHeader, serializeCookie } from '@shared/utils/cookie.utils';
import { errorBody, successBody } from '@shared/http/api-contract';

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

  public oauthStart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = String(req.params.provider || '').toLowerCase();
      const mode = req.query.mode === 'register' ? 'register' : 'login';
      const authorizeUrl = await this.service.buildOAuthAuthorizationUrl(provider as 'google' | 'github', mode);
      res.redirect(authorizeUrl);
    } catch (error) {
      if (error instanceof Error && error.message === 'OAUTH_NOT_CONFIGURED') {
        res.status(503).json(errorBody(res, 'SERVICE_UNAVAILABLE', 'OAuth provider is not configured'));
        return;
      }
      if (error instanceof Error && error.message === 'UNSUPPORTED_PROVIDER') {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'Unsupported OAuth provider'));
        return;
      }

      next(error);
    }
  };

  public oauthCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = String(req.params.provider || '').toLowerCase();
      const code = String(req.query.code || '');
      const state = String(req.query.state || '');

      if (!code || !state) {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'Missing OAuth code/state'));
        return;
      }

      const result = await this.service.handleOAuthCallback(provider as 'google' | 'github', code, state);
      setAuthCookies(res, result.accessToken, result.refreshToken);

      const redirectUrl = new URL(`${this.service.getFrontendUrl()}/oauth/callback`);
      redirectUrl.searchParams.set('accessToken', result.accessToken);
      redirectUrl.searchParams.set('refreshToken', result.refreshToken);
      redirectUrl.searchParams.set('provider', provider);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      if (error instanceof Error && error.message === 'OAUTH_NOT_CONFIGURED') {
        res.status(503).json(errorBody(res, 'SERVICE_UNAVAILABLE', 'OAuth provider is not configured'));
        return;
      }
      if (error instanceof Error && (error.message === 'INVALID_OAUTH_STATE' || error.message === 'OAUTH_EXCHANGE_FAILED' || error.message === 'OAUTH_EMAIL_UNAVAILABLE' || error.message === 'UNSUPPORTED_PROVIDER')) {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'OAuth sign-in failed'));
        return;
      }

      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await this.service.login(email, password);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json(successBody(res, result));
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Invalid email or password'));
        return;
      }

      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = parseCookieHeader(req.headers.cookie);
      const bodyRefreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
      const refreshToken = cookies.refresh_token || bodyRefreshToken;

      if (!refreshToken) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing refresh token'));
        return;
      }

      const result = await this.service.refreshSession(refreshToken);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(200).json(successBody(res, { accessToken: result.accessToken, refreshToken: result.refreshToken }));
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Invalid refresh token'));
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
      
      res.status(201).json(successBody(res, {
        message: 'Store this key securely. It will not be shown again.',
        key: plaintextKey,
      }));
    } catch (error) {
      next(error);
    }
  };

  public generateRumKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const { projectId, label, allowedOrigins } = req.body as {
        projectId?: string;
        label?: string;
        allowedOrigins?: string[];
      };

      if (!projectId) {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'projectId is required'));
        return;
      }

      try {
        await this.service.assertProjectOwner(projectId, userId);
      } catch {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'Only project owners can issue RUM keys'));
        return;
      }

      const key = await this.service.generateRumWriteKey(projectId, label, allowedOrigins);
      res.status(201).json(successBody(res, { message: 'Store this key securely. It will not be shown again.', key }));
    } catch (error) {
      next(error);
    }
  };
}
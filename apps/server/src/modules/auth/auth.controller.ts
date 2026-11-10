import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { parseCookieHeader } from '@shared/utils/cookie.utils';
import { errorBody, successBody } from '@shared/http/api-contract';
import { auditLogService } from '@shared/services/audit-log.service';
import { OAuthExchangeDto } from './dto/oauth.dto';
import { LoginDto } from '@modules/users/dto/user.dto';
import { CSRF_HEADER, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@shared/auth/session-cookie';


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

      // Only a short-lived single-use code goes in the URL; the web app swaps it for
      // tokens with POST /auth/oauth/exchange.
      const loginCode = await this.service.createOAuthLoginCode(result);
      const redirectUrl = new URL(`${this.service.getFrontendUrl()}/oauth/callback`);
      redirectUrl.searchParams.set('code', loginCode);
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

  public oauthExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = OAuthExchangeDto.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'A login code is required'));
        return;
      }

      const tokens = await this.service.exchangeOAuthLoginCode(parsed.data.code);
      setSessionCookies(res, tokens.accessToken, tokens.refreshToken);
      res.status(200).json(successBody(res, tokens));
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_OAUTH_CODE') {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Login code is invalid, expired or already used'));
        return;
      }

      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = LoginDto.parse(req.body); // invalid → 400 via the error handler
      const result = await this.service.login(email, password);
      setSessionCookies(res, result.accessToken, result.refreshToken);
      void auditLogService.recordSafe({
        actorUserId: result.user.id,
        action: 'auth.login',
        resourceType: 'user_session',
        resourceId: result.user.id,
        metadata: { email: result.user.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
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
      const cookieToken = parseCookieHeader(req.headers.cookie)[REFRESH_COOKIE];
      const bodyRefreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
      // A token in the body (SDKs, scripts) wins. The cookie is sent by browsers automatically,
      // so using it requires a custom header that other sites can't add without passing CORS.
      const refreshToken = bodyRefreshToken || cookieToken;

      if (!refreshToken) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing refresh token'));
        return;
      }
      if (!bodyRefreshToken && !req.get(CSRF_HEADER)) {
        res.status(403).json(errorBody(res, 'FORBIDDEN', `Refreshing with the session cookie requires the ${CSRF_HEADER} header`));
        return;
      }

      const result = await this.service.refreshSession(refreshToken);
      setSessionCookies(res, result.accessToken, result.refreshToken);
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
    void auditLogService.recordSafe({
      actorUserId: _req.user?.id ?? null,
      action: 'auth.logout',
      resourceType: 'user_session',
      resourceId: _req.user?.id ?? null,
      ipAddress: _req.ip,
      userAgent: _req.get('user-agent') ?? null,
    });
    clearSessionCookies(res);
    res.status(204).send();
  };

  public generateKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, label } = req.body;
      
      // In a full implementation, we'd verify the requesting user has 'admin' rights to this project
      const plaintextKey = await this.service.generateApiKey(projectId, label);
      void auditLogService.recordSafe({
        actorUserId: req.user?.id ?? null,
        projectId,
        action: 'key.created',
        resourceType: 'api_key',
        metadata: { label: label ?? null, source: 'auth.generateKey' },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      
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
      void auditLogService.recordSafe({
        actorUserId: userId,
        projectId,
        action: 'rum_key.created',
        resourceType: 'rum_key',
        metadata: { label: label ?? null, allowedOrigins: allowedOrigins ?? [] },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      });
      res.status(201).json(successBody(res, { message: 'Store this key securely. It will not be shown again.', key }));
    } catch (error) {
      next(error);
    }
  };
}
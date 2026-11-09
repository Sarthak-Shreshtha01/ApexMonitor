import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { appWith, PROJECT_A, PROJECT_B, project } from '../../helpers/fakes';
import { signAccessToken, signRefreshToken, signToken } from '@shared/auth/tokens';

const listProjects = vi.fn();
vi.mock('@modules/users/user.service', () => ({
  UserService: class {
    listProjects = listProjects;
  },
}));

const validateApiKey = vi.fn();
const validateRumWriteKey = vi.fn();
vi.mock('@modules/auth/auth.service', () => ({
  AuthService: class {
    validateApiKey = validateApiKey;
    validateRumWriteKey = validateRumWriteKey;
  },
}));

const { requireAuth } = await import('@shared/middleware/require-auth');
const { requireProjectAccess } = await import('@shared/middleware/require-project-access');
const { validateApiKey: apiKeyMw, validateRumWriteKey: rumKeyMw } = await import('@modules/auth/middleware/auth.middleware');
const { asyncHandler } = await import('@shared/middleware/async-handler');

const user = { id: 'usr_1', email: 'u@example.test' };
const echo = (req: any, res: any) => res.json({ user: req.user ?? null, project: req.project ?? null });

describe('requireAuth', () => {
  const app = appWith((a) => a.get('/p', requireAuth, echo));

  it('401 without Authorization header, in the canonical envelope', async () => {
    const res = await request(await app).get('/p');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'UNAUTHORIZED', message: 'Missing JWT Token', requestId: 'test-request-id' });
  });

  it('401 for non-Bearer schemes', async () => {
    const res = await request(await app).get('/p').set('authorization', `Basic ${signAccessToken(user)}`);
    expect(res.status).toBe(401);
  });

  it('accepts a valid access token and sets req.user', async () => {
    const res = await request(await app).get('/p').set('authorization', `Bearer ${signAccessToken(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it('KI-3: rejects a refresh token', async () => {
    const res = await request(await app).get('/p').set('authorization', `Bearer ${signRefreshToken(user)}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('rejects an OAuth state token', async () => {
    const res = await request(await app).get('/p').set('authorization', `Bearer ${signToken('oauth_state', { sub: 'x', email: 'y' })}`);
    expect(res.status).toBe(401);
  });

  it('rejects garbage tokens', async () => {
    const res = await request(await app).get('/p').set('authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });
});

describe('requireProjectAccess', () => {
  beforeEach(() => {
    listProjects.mockResolvedValue([project(PROJECT_A, 'owner'), project(PROJECT_B, 'developer')]);
  });

  const build = (opts: Parameters<typeof requireProjectAccess>[0]) =>
    appWith((a) => {
      a.use((req, _res, next) => {
        if (req.headers['x-user']) req.user = user;
        next();
      });
      a.all('/q{/:projectId}', requireProjectAccess(opts), echo);
    });

  it('401 when not authenticated', async () => {
    const res = await request(await build({})).get(`/q?projectId=${PROJECT_A}`);
    expect(res.status).toBe(401);
  });

  it('400 when projectId missing', async () => {
    const res = await request(await build({})).get('/q').set('x-user', '1');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('reads projectId from query by default and sets req.project with role', async () => {
    const res = await request(await build({})).get(`/q?projectId=${PROJECT_B}`).set('x-user', '1');
    expect(res.status).toBe(200);
    expect(res.body.project).toEqual({ id: PROJECT_B, role: 'developer' });
    expect(listProjects).toHaveBeenCalledWith(user.id);
  });

  it('reads projectId from params and body', async () => {
    const p = await request(await build({ source: 'params', key: 'projectId' })).get(`/q/${PROJECT_A}`).set('x-user', '1');
    expect(p.status).toBe(200);
    const b = await request(await build({ source: 'body' })).post('/q').set('x-user', '1').send({ projectId: PROJECT_A });
    expect(b.status).toBe(200);
  });

  it('ignores non-string projectId values', async () => {
    const res = await request(await build({})).get(`/q?projectId[]=${PROJECT_A}`).set('x-user', '1');
    expect(res.status).toBe(400);
  });

  it('403 for projects the user is not a member of', async () => {
    const res = await request(await build({})).get('/q?projectId=proj_cccccccccccccccccccccccc').set('x-user', '1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('403 when owner is required and user is a developer', async () => {
    const res = await request(await build({ requireOwner: true })).get(`/q?projectId=${PROJECT_B}`).set('x-user', '1');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Owner access required');
  });

  it('passes owners when owner is required', async () => {
    const res = await request(await build({ requireOwner: true })).get(`/q?projectId=${PROJECT_A}`).set('x-user', '1');
    expect(res.status).toBe(200);
  });

  it('forwards lookup errors to the error handler (500)', async () => {
    listProjects.mockRejectedValueOnce(new Error('db down'));
    const res = await request(await build({})).get(`/q?projectId=${PROJECT_A}`).set('x-user', '1');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });
});

describe('API key middleware', () => {
  const app = appWith((a) => {
    a.post('/ingest', apiKeyMw, echo);
    a.post('/rum', rumKeyMw, echo);
  });

  it('401 without x-api-key', async () => {
    const res = await request(await app).post('/ingest');
    expect(res.status).toBe(401);
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('sets req.project from the key', async () => {
    validateApiKey.mockResolvedValueOnce(PROJECT_A);
    const res = await request(await app).post('/ingest').set('x-api-key', 'pk_live_x');
    expect(res.status).toBe(200);
    expect(res.body.project).toEqual({ id: PROJECT_A });
    expect(validateApiKey).toHaveBeenCalledWith('pk_live_x');
  });

  it('401 for invalid keys', async () => {
    validateApiKey.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const res = await request(await app).post('/ingest').set('x-api-key', 'bad');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid API Key');
  });

  it('RUM: 401 without key, passes origin, 403 for disallowed origin, 401 for invalid key', async () => {
    expect((await request(await app).post('/rum')).status).toBe(401);

    validateRumWriteKey.mockResolvedValueOnce(PROJECT_A);
    const ok = await request(await app).post('/rum').set('x-rum-key', 'rum_x').set('origin', 'https://shop.example');
    expect(ok.status).toBe(200);
    expect(validateRumWriteKey).toHaveBeenCalledWith('rum_x', 'https://shop.example');

    validateRumWriteKey.mockRejectedValueOnce(new Error('ORIGIN_NOT_ALLOWED'));
    expect((await request(await app).post('/rum').set('x-rum-key', 'rum_x')).status).toBe(403);

    validateRumWriteKey.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    expect((await request(await app).post('/rum').set('x-rum-key', 'rum_x')).status).toBe(401);
  });
});

describe('error handling', () => {
  const app = appWith((a) => {
    a.get('/zod', () => {
      z.object({ a: z.string() }).parse({});
    });
    a.get('/known/:code', (req) => {
      throw new Error(req.params.code);
    });
    a.get('/async', asyncHandler(async () => {
      throw new Error('PROJECT_ACCESS_DENIED');
    }));
    a.get('/async-ok', asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    }));
    a.get('/string-throw', () => {
      throw 'plain string';
    });
  });

  it('maps ZodError to 400 VALIDATION_ERROR with details', async () => {
    const res = await request(await app).get('/zod');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.details.fieldErrors.a).toBeDefined();
    expect(res.body.requestId).toBe('test-request-id');
  });

  it.each([
    ['EMAIL_IN_USE', 409, 'CONFLICT'],
    ['INVALID_CREDENTIALS', 401, 'UNAUTHORIZED'],
    ['INVALID_REFRESH_TOKEN', 401, 'UNAUTHORIZED'],
    ['USER_NOT_FOUND', 404, 'NOT_FOUND'],
    ['PROJECT_ACCESS_DENIED', 403, 'FORBIDDEN'],
    ['RATE_LIMITED', 429, 'RATE_LIMIT_EXCEEDED'],
    ['KEY_NOT_FOUND', 404, 'NOT_FOUND'],
    ['TRACE_NOT_FOUND', 404, 'NOT_FOUND'],
    ['SOMETHING_ELSE', 500, 'INTERNAL_ERROR'],
  ])('maps thrown %s to %i %s', async (code, status, error) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(await app).get(`/known/${code}`);
    expect(res.status).toBe(status);
    expect(res.body.error).toBe(error);
  });

  it('asyncHandler forwards rejected promises and passes through success', async () => {
    expect((await request(await app).get('/async')).status).toBe(403);
    expect((await request(await app).get('/async-ok')).body).toEqual({ ok: true });
  });

  it('handles non-Error throws as 500 without leaking details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(await app).get('/string-throw');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unexpected server error');
  });

  it('404 handler names the route', async () => {
    const res = await request(await app).delete('/nope');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route DELETE /nope not found');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { appWith, PROJECT_A } from '../../helpers/fakes';

vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => ({ query: vi.fn(async () => ({ rows: [] })) }) }));
vi.mock('@infrastructure/redis', () => ({ getRedis: () => ({}) }));
const recordSafe = vi.fn(async () => undefined);
vi.mock('@shared/services/audit-log.service', () => ({ auditLogService: { recordSafe } }));

const tokens = { accessToken: 'acc', refreshToken: 'ref', token: 'acc', user: { id: 'usr_1', email: 'u@x.test', name: 'U' } };
const userSvc = {
  register: vi.fn(), login: vi.fn(), refreshSession: vi.fn(), getProfile: vi.fn(), updateProfile: vi.fn(),
  listProjects: vi.fn(async () => [{ id: PROJECT_A, role: 'owner' }]),
  listProjectMembers: vi.fn(), addProjectMember: vi.fn(), updateMemberRole: vi.fn(), removeMember: vi.fn(),
};
vi.mock('@modules/users/user.service', () => ({ UserService: class { constructor() { return userSvc; } } }));
const authSvc = {
  login: vi.fn(), refreshSession: vi.fn(), generateApiKey: vi.fn(async () => 'proj_newkey'), generateRumWriteKey: vi.fn(async () => 'rum_newkey'),
  assertProjectOwner: vi.fn(), buildOAuthAuthorizationUrl: vi.fn(), handleOAuthCallback: vi.fn(), getFrontendUrl: () => 'http://web',
};
vi.mock('@modules/auth/auth.service', () => ({ AuthService: class { constructor() { return authSvc; } } }));

const { authRouter } = await import('@modules/auth/auth.router');
const { userRouter } = await import('@modules/users/user.router');
const { signAccessToken } = await import('@shared/auth/tokens');
const { knownBug } = await import('../../helpers/known-bug');

const app = appWith((a) => {
  a.use('/auth', authRouter);
  a.use('/users', userRouter);
});
const bearer = { authorization: `Bearer ${signAccessToken({ id: 'usr_1', email: 'u@x.test' })}` };

beforeEach(() => {
  Object.values(userSvc).forEach((f) => f.mockClear());
  Object.values(authSvc).forEach((f) => typeof f === 'function' && 'mockClear' in f && f.mockClear());
});

describe('auth routes', () => {
  it('POST /auth/login sets the refresh cookie + X-Access-Token and returns the envelope', async () => {
    authSvc.login.mockResolvedValueOnce(tokens);
    const res = await request(await app).post('/auth/login').send({ email: 'u@x.test', password: 'p' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('acc');
    expect(res.headers['x-access-token']).toBe('acc');
    expect(res.headers['set-cookie'][0]).toMatch(/^refresh_token=ref; Max-Age=2592000; Path=\/; SameSite=Lax; HttpOnly$/);
    expect(recordSafe).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login' }));
  });

  it('POST /auth/login → 401 on bad credentials', async () => {
    authSvc.login.mockRejectedValueOnce(new Error('INVALID_CREDENTIALS'));
    const res = await request(await app).post('/auth/login').send({ email: 'u@x.test', password: 'bad' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('POST /auth/refresh prefers the cookie, falls back to body, 401 when missing/invalid', async () => {
    authSvc.refreshSession.mockResolvedValue(tokens);
    await request(await app).post('/auth/refresh').set('cookie', 'refresh_token=from-cookie').send({ refreshToken: 'from-body' });
    expect(authSvc.refreshSession).toHaveBeenLastCalledWith('from-cookie');
    await request(await app).post('/auth/refresh').send({ refreshToken: 'from-body' });
    expect(authSvc.refreshSession).toHaveBeenLastCalledWith('from-body');
    expect((await request(await app).post('/auth/refresh').send({})).status).toBe(401);
    authSvc.refreshSession.mockRejectedValueOnce(new Error('INVALID_REFRESH_TOKEN'));
    expect((await request(await app).post('/auth/refresh').send({ refreshToken: 'x' })).status).toBe(401);
  });

  it('POST /auth/logout clears the cookie', async () => {
    const res = await request(await app).post('/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toContain('refresh_token=; Max-Age=0');
  });

  it('OAuth start: redirect, 503 unconfigured, 400 unsupported', async () => {
    authSvc.buildOAuthAuthorizationUrl.mockResolvedValueOnce('https://accounts.google.com/x');
    const ok = await request(await app).get('/auth/oauth/Google/start?mode=register');
    expect(ok.status).toBe(302);
    expect(authSvc.buildOAuthAuthorizationUrl).toHaveBeenCalledWith('google', 'register');
    authSvc.buildOAuthAuthorizationUrl.mockRejectedValueOnce(new Error('OAUTH_NOT_CONFIGURED'));
    expect((await request(await app).get('/auth/oauth/google/start')).status).toBe(503);
    authSvc.buildOAuthAuthorizationUrl.mockRejectedValueOnce(new Error('UNSUPPORTED_PROVIDER'));
    expect((await request(await app).get('/auth/oauth/foo/start')).status).toBe(400);
  });

  it('OAuth callback: 400 without code/state or on provider failure, 302 on success', async () => {
    expect((await request(await app).get('/auth/oauth/google/callback?code=c')).status).toBe(400);
    authSvc.handleOAuthCallback.mockRejectedValueOnce(new Error('INVALID_OAUTH_STATE'));
    expect((await request(await app).get('/auth/oauth/google/callback?code=c&state=s')).status).toBe(400);
    authSvc.handleOAuthCallback.mockResolvedValueOnce(tokens);
    const ok = await request(await app).get('/auth/oauth/google/callback?code=c&state=s');
    expect(ok.status).toBe(302);
    expect(ok.headers.location.startsWith('http://web/oauth/callback')).toBe(true);
  });

  knownBug('KI-4', 'OAuth callback does not put tokens in the redirect URL', async () => {
    authSvc.handleOAuthCallback.mockResolvedValueOnce(tokens);
    const res = await request(await app).get('/auth/oauth/google/callback?code=c&state=s');
    expect(res.headers.location).not.toMatch(/accessToken|refreshToken/);
  });

  it('POST /auth/keys and /auth/rum-keys: 401 unauthenticated, owner-only, 201 with the key', async () => {
    expect((await request(await app).post('/auth/keys').send({ projectId: PROJECT_A })).status).toBe(401);
    expect((await request(await app).post('/auth/keys').set(bearer).send({ projectId: 'proj_notmine000000000000000' })).status).toBe(403);
    const key = await request(await app).post('/auth/keys').set(bearer).send({ projectId: PROJECT_A, label: 'x' });
    expect(key.status).toBe(201);
    expect(key.body.data.key).toBe('proj_newkey');
    const rum = await request(await app).post('/auth/rum-keys').set(bearer).send({ projectId: PROJECT_A, allowedOrigins: ['https://a'] });
    expect(rum.status).toBe(201);
    expect(authSvc.generateRumWriteKey).toHaveBeenCalledWith(PROJECT_A, undefined, ['https://a']);
  });
});

describe('users routes', () => {
  it('POST /users/register → 201 and sets cookie; 409 duplicate; 400 invalid', async () => {
    userSvc.register.mockResolvedValueOnce(tokens);
    const ok = await request(await app).post('/users/register').send({ email: 'a@b.co', password: 'password1', name: 'Al' });
    expect(ok.status).toBe(201);
    expect(ok.headers['set-cookie'][0]).toContain('refresh_token=ref');
    userSvc.register.mockRejectedValueOnce(new Error('EMAIL_IN_USE'));
    expect((await request(await app).post('/users/register').send({ email: 'a@b.co', password: 'password1', name: 'Al' })).status).toBe(409);
    expect((await request(await app).post('/users/register').send({ email: 'bad' })).status).toBe(400);
  });

  it('POST /users/login → 200 / 401 / 400', async () => {
    userSvc.login.mockResolvedValueOnce(tokens);
    expect((await request(await app).post('/users/login').send({ email: 'a@b.co', password: 'p' })).status).toBe(200);
    userSvc.login.mockRejectedValueOnce(new Error('INVALID_CREDENTIALS'));
    expect((await request(await app).post('/users/login').send({ email: 'a@b.co', password: 'p' })).status).toBe(401);
    expect((await request(await app).post('/users/login').send({})).status).toBe(400);
  });

  it('GET/PATCH /users/me', async () => {
    expect((await request(await app).get('/users/me')).status).toBe(401);
    userSvc.getProfile.mockResolvedValueOnce({ id: 'usr_1' });
    expect((await request(await app).get('/users/me').set(bearer)).body).toEqual({ profile: { id: 'usr_1' } });
    userSvc.getProfile.mockRejectedValueOnce(new Error('USER_NOT_FOUND'));
    expect((await request(await app).get('/users/me').set(bearer)).status).toBe(404);
    userSvc.updateProfile.mockResolvedValueOnce({ id: 'usr_1', email: 'n@x.test' });
    expect((await request(await app).patch('/users/me').set(bearer).send({ name: 'New', email: 'n@x.test' })).status).toBe(200);
    userSvc.updateProfile.mockRejectedValueOnce(new Error('EMAIL_IN_USE'));
    expect((await request(await app).patch('/users/me').set(bearer).send({ name: 'New', email: 'n@x.test' })).status).toBe(409);
    expect((await request(await app).patch('/users/me').set(bearer).send({ name: 'N' })).status).toBe(400);
  });

  it('members: list, add (400 missing fields / 404 unknown), update, remove (400 last owner)', async () => {
    const base = `/users/${PROJECT_A}/members`;
    userSvc.listProjectMembers.mockResolvedValueOnce([{ userId: 'u' }]);
    expect((await request(await app).get(base).set(bearer)).body).toEqual({ members: [{ userId: 'u' }] });
    expect((await request(await app).post(base).set(bearer).send({ email: 'm@x' })).status).toBe(400);
    userSvc.addProjectMember.mockRejectedValueOnce(new Error('USER_NOT_FOUND'));
    expect((await request(await app).post(base).set(bearer).send({ email: 'm@x', role: 'developer' })).status).toBe(404);
    userSvc.addProjectMember.mockResolvedValueOnce({ userId: 'usr_m' });
    expect((await request(await app).post(base).set(bearer).send({ email: 'm@x', role: 'developer' })).status).toBe(201);
    expect((await request(await app).patch(`${base}/usr_m`).set(bearer).send({})).status).toBe(400);
    userSvc.updateMemberRole.mockResolvedValueOnce({ userId: 'usr_m', role: 'owner' });
    expect((await request(await app).patch(`${base}/usr_m`).set(bearer).send({ role: 'owner' })).status).toBe(200);
    userSvc.removeMember.mockRejectedValueOnce(new Error('CANNOT_REMOVE_LAST_OWNER'));
    expect((await request(await app).delete(`${base}/usr_1`).set(bearer)).status).toBe(400);
    expect((await request(await app).delete(`${base}/usr_m`).set(bearer)).status).toBe(204);
  });

  it('members: non-members get 403 from the route guard', async () => {
    expect((await request(await app).get('/users/proj_notmine000000000000000/members').set(bearer)).status).toBe(403);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { api, registerTenant, Tenant } from './harness';

describe('authentication (real stack)', () => {
  let t: Tenant;
  beforeAll(async () => {
    t = await registerTenant('auth');
  });

  it('register creates the user, a default project, an owner membership and an audit entry', async () => {
    const projects = await api('GET', '/api/v1/projects', { token: t.accessToken });
    expect(projects.body.data.projects).toHaveLength(1);
    expect(projects.body.data.projects[0]).toMatchObject({ role: 'owner', name: "Test's Project" });
  });

  it('register rejects a duplicate email (409) and invalid payloads (400)', async () => {
    expect((await api('POST', '/api/v1/users/register', { body: { email: t.email, password: 'password123', name: 'Dup' } })).status).toBe(409);
    expect((await api('POST', '/api/v1/users/register', { body: { email: 'bad', password: 'x', name: 'Y' } })).status).toBe(400);
  });

  it('login via /auth/login and /users/login', async () => {
    const a = await api('POST', '/api/v1/auth/login', { body: { email: t.email, password: t.password } });
    expect(a.status).toBe(200);
    expect(a.body.data.user.id).toBe(t.userId);
    expect(a.headers.get('set-cookie')).toMatch(/refresh_token=.*HttpOnly/);
    const u = await api('POST', '/api/v1/users/login', { body: { email: t.email, password: t.password } });
    expect(u.status).toBe(200);
  });

  it('login rejects wrong passwords and unknown users with 401', async () => {
    expect((await api('POST', '/api/v1/auth/login', { body: { email: t.email, password: 'wrong-password' } })).status).toBe(401);
    expect((await api('POST', '/api/v1/auth/login', { body: { email: 'ghost@example.test', password: 'x' } })).status).toBe(401);
  });

  it('access token reads /users/me; refresh token is rejected (KI-3)', async () => {
    const me = await api('GET', '/api/v1/users/me', { token: t.accessToken });
    expect(me.status).toBe(200);
    expect(me.body.profile).toMatchObject({ id: t.userId, email: t.email });
    expect((await api('GET', '/api/v1/users/me', { token: t.refreshToken })).status).toBe(401);
  });

  it('refresh: cookie or body refresh token → new working pair; access token or garbage → 401', async () => {
    const viaBody = await api('POST', '/api/v1/auth/refresh', { body: { refreshToken: t.refreshToken } });
    expect(viaBody.status).toBe(200);
    expect((await api('GET', '/api/v1/users/me', { token: viaBody.body.data.accessToken })).status).toBe(200);
    const viaCookie = await api('POST', '/api/v1/auth/refresh', { headers: { cookie: `refresh_token=${t.refreshToken}` } });
    expect(viaCookie.status).toBe(200);
    expect((await api('POST', '/api/v1/auth/refresh', { body: { refreshToken: t.accessToken } })).status).toBe(401);
    expect((await api('POST', '/api/v1/auth/refresh', { body: { refreshToken: 'garbage' } })).status).toBe(401);
    expect((await api('POST', '/api/v1/auth/refresh', {})).status).toBe(401);
  });

  it('profile update persists and rejects taken emails', async () => {
    const other = await registerTenant('other');
    const ok = await api('PATCH', '/api/v1/users/me', { token: t.accessToken, body: { name: 'Renamed', email: t.email, company: 'Acme', timezone: 'Asia/Kolkata' } });
    expect(ok.status).toBe(200);
    expect(ok.body.profile).toMatchObject({ name: 'Renamed', company: 'Acme', timezone: 'Asia/Kolkata' });
    expect((await api('PATCH', '/api/v1/users/me', { token: t.accessToken, body: { name: 'X Y', email: other.email } })).status).toBe(409);
  });

  it('logout clears the refresh cookie', async () => {
    const res = await api('POST', '/api/v1/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('OAuth login codes: exchanged once for working tokens, then refused (KI-4)', async () => {
    const { AuthService } = await import('@modules/auth/auth.service');
    const fresh = await api('POST', '/api/v1/auth/login', { body: { email: t.email, password: t.password } });
    const issued = { accessToken: fresh.body.data.accessToken, refreshToken: fresh.body.data.refreshToken };
    const code = await new AuthService().createOAuthLoginCode(issued);

    const first = await api('POST', '/api/v1/auth/oauth/exchange', { body: { code } });
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual(issued);
    expect(first.headers.get('set-cookie')).toContain('refresh_token=');
    expect((await api('GET', '/api/v1/users/me', { token: first.body.data.accessToken })).status).toBe(200);

    expect((await api('POST', '/api/v1/auth/oauth/exchange', { body: { code } })).status).toBe(401);
    expect((await api('POST', '/api/v1/auth/oauth/exchange', { body: { code: 'nope' } })).status).toBe(400);
  });

  it('OAuth start without provider configuration → 503; unknown provider → 400; callback validation → 400', async () => {
    expect((await api('GET', '/api/v1/auth/oauth/google/start')).status).toBe(503);
    expect((await api('GET', '/api/v1/auth/oauth/myspace/start')).status).toBe(400);
    expect((await api('GET', '/api/v1/auth/oauth/google/callback')).status).toBe(400);
  });

  it('audit log records sign-up and login', async () => {
    const { pgQuery } = await import('./harness');
    const rows = await pgQuery<{ action: string }>('SELECT action FROM audit_logs WHERE actor_user_id = $1', [t.userId]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['user.registered', 'auth.login', 'user.logged_in']));
  });

  it('request logs never contain issued tokens (set-cookie / x-access-token) (KI-35)', async () => {
    const pino = (await import('pino')).default;
    const { logger } = await import('@shared/utils/logger');
    // Capture exactly what pino serialises to its destination.
    const stream = (logger as any)[pino.symbols.streamSym];
    const originalWrite = stream.write;
    const lines: string[] = [];
    const level = logger.level;
    logger.level = 'info';
    stream.write = (chunk: string) => {
      lines.push(String(chunk));
      return true;
    };
    try {
      const login = await api('POST', '/api/v1/auth/login', { body: { email: t.email, password: t.password } });
      await new Promise((r) => setTimeout(r, 50));
      const token = login.body.data.accessToken as string;
      expect(lines.join('').length).toBeGreaterThan(0);
      expect(lines.some((l) => l.includes(token))).toBe(false);
    } finally {
      stream.write = originalWrite;
      logger.level = level;
    }
  });
});

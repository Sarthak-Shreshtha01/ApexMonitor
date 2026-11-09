import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { config } from '@config';
import { FakeRedis, PROJECT_A } from '../../helpers/fakes';
import { knownBug } from '../../helpers/known-bug';

const redis = new FakeRedis();
vi.mock('@infrastructure/redis', () => ({ getRedis: () => redis }));
vi.mock('@infrastructure/db/postgres', () => ({ getPg: () => ({ query: vi.fn(async () => ({ rows: [] })) }) }));

const authRepo = {
  findKeyByPrefix: vi.fn(),
  updateLastUsed: vi.fn(),
  insertKey: vi.fn(),
  findRumKeyByPrefix: vi.fn(),
  insertRumKey: vi.fn(),
  updateRumLastUsed: vi.fn(),
  getProjectMember: vi.fn(),
};
vi.mock('@modules/auth/auth.repository', () => ({ AuthRepository: class { constructor() { return authRepo; } } }));

const userRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  createUserWithDefaultProject: vi.fn(),
  listProjectsByUserId: vi.fn(),
  createProjectForUser: vi.fn(),
  updateProfile: vi.fn(),
  listProjectMembers: vi.fn(),
  addProjectMember: vi.fn(),
  getProjectMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
};
vi.mock('@modules/users/user.repository', () => ({ UserRepository: class { constructor() { return userRepo; } } }));

const { AuthService } = await import('@modules/auth/auth.service');
const { UserService } = await import('@modules/users/user.service');
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = await import('@shared/auth/tokens');

const fastHash = (v: string) => argon2.hash(v + config.ARGON2_PEPPER, { type: argon2.argon2id, memoryCost: 1024, timeCost: 2, parallelism: 1 });
const projRecord = (id: string, role: string) => ({ id, name: id, owner_user_id: 'usr_o', role, plan: 'free', rate_limit_rpm: 60000, log_retention_days: 90, created_at: 'c', updated_at: 'u' });

beforeEach(() => {
  redis.store.clear();
  Object.values(authRepo).forEach((f) => f.mockReset());
  Object.values(userRepo).forEach((f) => f.mockReset());
});

describe('AuthService.validateApiKey', () => {
  const service = new AuthService();

  it('returns the cached project without touching the database', async () => {
    redis.store.set('api_key_cache:pk_live_abc', PROJECT_A);
    await expect(service.validateApiKey('pk_live_abc')).resolves.toBe(PROJECT_A);
    expect(authRepo.findKeyByPrefix).not.toHaveBeenCalled();
  });

  it('verifies against the stored argon2 hash, caches for 5 minutes and touches last_used', async () => {
    const key = 'pk_live_XYZ123456789';
    authRepo.findKeyByPrefix.mockResolvedValue({ id: 7, project_id: PROJECT_A, key_hash: await fastHash(key) });
    await expect(service.validateApiKey(key)).resolves.toBe(PROJECT_A);
    expect(authRepo.findKeyByPrefix).toHaveBeenCalledWith(key.substring(0, 10));
    expect(redis.ttl.get(`api_key_cache:${key}`)).toBe(300);
    expect(authRepo.updateLastUsed).toHaveBeenCalledWith(7);
  });

  it('rejects unknown prefixes and wrong keys with the same prefix', async () => {
    authRepo.findKeyByPrefix.mockResolvedValueOnce(undefined);
    await expect(service.validateApiKey('pk_live_nope')).rejects.toThrow('UNAUTHORIZED');
    authRepo.findKeyByPrefix.mockResolvedValueOnce({ id: 1, project_id: PROJECT_A, key_hash: await fastHash('pk_live_REAL') });
    await expect(service.validateApiKey('pk_live_FAKE')).rejects.toThrow('UNAUTHORIZED');
    expect(redis.store.size).toBe(0);
  });

  it('a key hashed without the pepper is rejected', async () => {
    const key = 'pk_live_nopepper';
    authRepo.findKeyByPrefix.mockResolvedValue({ id: 1, project_id: PROJECT_A, key_hash: await argon2.hash(key) });
    await expect(service.validateApiKey(key)).rejects.toThrow('UNAUTHORIZED');
  });

  knownBug('KI-5', 'the raw secret is not used as a Redis key name', async () => {
    const key = 'pk_live_SECRET123';
    authRepo.findKeyByPrefix.mockResolvedValue({ id: 1, project_id: PROJECT_A, key_hash: await fastHash(key) });
    await service.validateApiKey(key);
    expect([...redis.store.keys()].some((k) => k.includes(key))).toBe(false);
  });
});

describe('AuthService key generation', () => {
  const service = new AuthService();

  it('generates proj_ ingest keys, stores only prefix + peppered hash', async () => {
    const key = await service.generateApiKey(PROJECT_A, 'ci');
    expect(key).toMatch(/^proj_[A-Za-z0-9_-]{43}$/);
    const stored = authRepo.insertKey.mock.calls[0][0];
    expect(stored).toMatchObject({ projectId: PROJECT_A, keyPrefix: key.substring(0, 10), label: 'ci' });
    expect(stored.keyHash).not.toContain(key);
    expect(await argon2.verify(stored.keyHash, key + config.ARGON2_PEPPER)).toBe(true);
  });

  it('generates rum_ keys with allowed origins', async () => {
    const key = await service.generateRumWriteKey(PROJECT_A, 'web', ['https://a.example']);
    expect(key.startsWith('rum_')).toBe(true);
    expect(authRepo.insertRumKey.mock.calls[0][0]).toMatchObject({ projectId: PROJECT_A, allowedOrigins: ['https://a.example'] });
  });

  it('assertProjectOwner only passes owners', async () => {
    authRepo.getProjectMember.mockResolvedValueOnce({ role: 'owner' });
    await expect(service.assertProjectOwner(PROJECT_A, 'u')).resolves.toBeUndefined();
    authRepo.getProjectMember.mockResolvedValueOnce({ role: 'developer' });
    await expect(service.assertProjectOwner(PROJECT_A, 'u')).rejects.toThrow('PROJECT_ACCESS_DENIED');
    authRepo.getProjectMember.mockResolvedValueOnce(undefined);
    await expect(service.assertProjectOwner(PROJECT_A, 'u')).rejects.toThrow('PROJECT_ACCESS_DENIED');
  });
});

describe('AuthService.validateRumWriteKey', () => {
  const service = new AuthService();
  const key = 'rum_ABCDEFGHIJKLMNOP';

  it('allows listed origins case-insensitively and caches', async () => {
    authRepo.findRumKeyByPrefix.mockResolvedValue({ id: 2, project_id: PROJECT_A, key_hash: await fastHash(key), allowed_origins: ['https://Shop.Example'] });
    await expect(service.validateRumWriteKey(key, 'https://shop.example')).resolves.toBe(PROJECT_A);
    expect(redis.store.get(`rum_key_cache:${key}`)).toBe(PROJECT_A);
  });

  it('rejects origins not in the allow-list', async () => {
    authRepo.findRumKeyByPrefix.mockResolvedValue({ id: 2, project_id: PROJECT_A, key_hash: await fastHash(key), allowed_origins: ['https://shop.example'] });
    await expect(service.validateRumWriteKey(key, 'https://evil.example')).rejects.toThrow('ORIGIN_NOT_ALLOWED');
  });

  it('accepts any origin when the allow-list is empty', async () => {
    authRepo.findRumKeyByPrefix.mockResolvedValue({ id: 2, project_id: PROJECT_A, key_hash: await fastHash(key), allowed_origins: [] });
    await expect(service.validateRumWriteKey(key, 'https://any.example')).resolves.toBe(PROJECT_A);
  });

  it('rejects unknown and wrong keys', async () => {
    authRepo.findRumKeyByPrefix.mockResolvedValueOnce(undefined);
    await expect(service.validateRumWriteKey(key, '')).rejects.toThrow('UNAUTHORIZED');
    authRepo.findRumKeyByPrefix.mockResolvedValueOnce({ id: 2, project_id: PROJECT_A, key_hash: await fastHash('rum_other'), allowed_origins: [] });
    await expect(service.validateRumWriteKey(key, '')).rejects.toThrow('UNAUTHORIZED');
  });
});

describe('AuthService OAuth', () => {
  const service = new AuthService();
  const original = { ...config };
  afterEach(() => {
    Object.assign(config, original);
    vi.unstubAllGlobals();
  });

  it('503-style error when providers are not configured', async () => {
    await expect(service.buildOAuthAuthorizationUrl('google', 'login')).rejects.toThrow('OAUTH_NOT_CONFIGURED');
    await expect(service.buildOAuthAuthorizationUrl('github', 'login')).rejects.toThrow('OAUTH_NOT_CONFIGURED');
    await expect(service.buildOAuthAuthorizationUrl('gitlab' as never, 'login')).rejects.toThrow('UNSUPPORTED_PROVIDER');
  });

  it('builds provider URLs with a signed oauth_state that is not an access token', async () => {
    Object.assign(config, { GOOGLE_CLIENT_ID: 'gid', GOOGLE_REDIRECT_URI: 'http://api/cb', GITHUB_CLIENT_ID: 'hid', GITHUB_REDIRECT_URI: 'http://api/gh' });
    const g = new URL(await service.buildOAuthAuthorizationUrl('google', 'register'));
    expect(g.origin).toBe('https://accounts.google.com');
    expect(g.searchParams.get('client_id')).toBe('gid');
    const state = g.searchParams.get('state')!;
    expect(() => verifyAccessToken(state)).toThrow();
    const h = new URL(await service.buildOAuthAuthorizationUrl('github', 'login'));
    expect(h.origin).toBe('https://github.com');
    expect(h.searchParams.get('scope')).toBe('read:user user:email');
  });

  it('rejects callbacks with invalid, cross-provider or access-token state', async () => {
    Object.assign(config, { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 's', GOOGLE_REDIRECT_URI: 'http://api/cb', GITHUB_CLIENT_ID: 'hid', GITHUB_REDIRECT_URI: 'http://api/gh' });
    await expect(service.handleOAuthCallback('google', 'code', 'garbage')).rejects.toThrow('INVALID_OAUTH_STATE');
    const githubState = new URL(await service.buildOAuthAuthorizationUrl('github', 'login')).searchParams.get('state')!;
    await expect(service.handleOAuthCallback('google', 'code', githubState)).rejects.toThrow('INVALID_OAUTH_STATE');
    const access = signAccessToken({ id: 'u', email: 'e@x' });
    await expect(service.handleOAuthCallback('google', 'code', access)).rejects.toThrow('INVALID_OAUTH_STATE');
  });

  it('completes the Google flow and logs in/registers the user', async () => {
    Object.assign(config, { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 's', GOOGLE_REDIRECT_URI: 'http://api/cb' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'g-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'g@example.test', name: 'G User' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    userRepo.findByEmail.mockResolvedValue({ id: 'usr_g', email: 'g@example.test', name: 'G User' });
    const state = new URL(await service.buildOAuthAuthorizationUrl('google', 'login')).searchParams.get('state')!;
    const result = await service.handleOAuthCallback('google', 'the-code', state);
    expect(fetchMock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(String(fetchMock.mock.calls[0][1].body)).toContain('code=the-code');
    expect(verifyAccessToken(result.accessToken)).toEqual({ id: 'usr_g', email: 'g@example.test' });
    expect(verifyRefreshToken(result.refreshToken).id).toBe('usr_g');
  });

  it('fails the Google flow when the provider exchange or profile fails', async () => {
    Object.assign(config, { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 's', GOOGLE_REDIRECT_URI: 'http://api/cb' });
    const state = () => service.buildOAuthAuthorizationUrl('google', 'login').then((u) => new URL(u).searchParams.get('state')!);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 400 })));
    await expect(service.handleOAuthCallback('google', 'c', await state())).rejects.toThrow('OAUTH_EXCHANGE_FAILED');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 't' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'no email' }))));
    await expect(service.handleOAuthCallback('google', 'c', await state())).rejects.toThrow('OAUTH_EMAIL_UNAVAILABLE');
  });

  it('completes the GitHub flow using the primary verified email', async () => {
    Object.assign(config, { GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 's', GITHUB_REDIRECT_URI: 'http://api/gh' });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'h' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ login: 'octo' })))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { email: 'unverified@x', primary: true, verified: false },
        { email: 'primary@x', primary: true, verified: true },
      ]))));
    userRepo.findByEmail.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'usr_new', email: 'primary@x', name: 'octo' });
    const state = new URL(await service.buildOAuthAuthorizationUrl('github', 'register')).searchParams.get('state')!;
    const result = await service.handleOAuthCallback('github', 'c', state);
    expect(userRepo.createUserWithDefaultProject).toHaveBeenCalledWith(expect.objectContaining({ email: 'primary@x', name: 'octo' }));
    expect(result.user.id).toBe('usr_new');
  });
});

describe('UserService', () => {
  const service = new UserService();

  it('register rejects duplicate emails', async () => {
    userRepo.findByEmail.mockResolvedValue({ id: 'x' });
    await expect(service.register({ email: 'a@b.co', password: 'password1', name: 'Al' })).rejects.toThrow('EMAIL_IN_USE');
  });

  it('register creates a user with a default project and returns working tokens', async () => {
    userRepo.findByEmail.mockResolvedValue(undefined);
    const result = await service.register({ email: 'a@b.co', password: 'password1', name: 'Ada Lovelace' });
    const created = userRepo.createUserWithDefaultProject.mock.calls[0][0];
    expect(created.id).toMatch(/^usr_[0-9a-f]{32}$/);
    expect(created.defaultProjectId).toMatch(/^proj_[0-9a-f]{24}$/);
    expect(created.defaultProjectName).toBe("Ada's Project");
    expect(await argon2.verify(created.passwordHash, `password1${config.ARGON2_PEPPER}`)).toBe(true);
    expect(verifyAccessToken(result.accessToken).id).toBe(created.id);
    expect(result.token).toBe(result.accessToken);
  });

  it('login rejects unknown users and wrong passwords, accepts the right one', async () => {
    userRepo.findByEmail.mockResolvedValueOnce(undefined);
    await expect(service.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow('INVALID_CREDENTIALS');
    const hash = await fastHash('right-password');
    userRepo.findByEmail.mockResolvedValue({ id: 'usr_1', email: 'a@b.co', name: 'A', password_hash: hash });
    await expect(service.login({ email: 'a@b.co', password: 'wrong' })).rejects.toThrow('INVALID_CREDENTIALS');
    await expect(service.login({ email: 'a@b.co', password: 'right-password' })).resolves.toMatchObject({ user: { id: 'usr_1' } });
  });

  it('refreshSession accepts refresh tokens only and checks the user still matches', async () => {
    userRepo.findByEmail.mockResolvedValue({ id: 'usr_1', email: 'a@b.co', name: 'A' });
    const refreshed = await service.refreshSession(signRefreshToken({ id: 'usr_1', email: 'a@b.co' }));
    expect(verifyAccessToken(refreshed.accessToken).id).toBe('usr_1');
    await expect(service.refreshSession(signAccessToken({ id: 'usr_1', email: 'a@b.co' }))).rejects.toThrow('INVALID_REFRESH_TOKEN');
    await expect(service.refreshSession('garbage')).rejects.toThrow('INVALID_REFRESH_TOKEN');
    await expect(service.refreshSession(signRefreshToken({ id: 'usr_other', email: 'a@b.co' }))).rejects.toThrow('INVALID_REFRESH_TOKEN');
    userRepo.findByEmail.mockResolvedValue(undefined);
    await expect(service.refreshSession(signRefreshToken({ id: 'usr_1', email: 'a@b.co' }))).rejects.toThrow('INVALID_REFRESH_TOKEN');
  });

  it('profile read/update', async () => {
    userRepo.findById.mockResolvedValueOnce(undefined);
    await expect(service.getProfile('u')).rejects.toThrow('USER_NOT_FOUND');
    userRepo.findById.mockResolvedValueOnce({ id: 'u', email: 'e', name: 'n', company: null, created_at: 'c' });
    await expect(service.getProfile('u')).resolves.toMatchObject({ id: 'u', company: null, jobTitle: null, timezone: null });
    userRepo.findByEmail.mockResolvedValueOnce({ id: 'someone-else' });
    await expect(service.updateProfile('u', 'n', 'taken@x')).rejects.toThrow('EMAIL_IN_USE');
    userRepo.findByEmail.mockResolvedValueOnce(undefined);
    userRepo.updateProfile.mockResolvedValueOnce(undefined);
    await expect(service.updateProfile('u', 'n', 'free@x')).rejects.toThrow('USER_NOT_FOUND');
  });

  it('createProject returns the created record or fails loudly', async () => {
    userRepo.listProjectsByUserId.mockImplementation(async () => [projRecord(userRepo.createProjectForUser.mock.calls.at(-1)?.[1], 'owner')]);
    const p = await service.createProject('u', '  New  ');
    expect(userRepo.createProjectForUser.mock.calls[0][2]).toBe('New');
    expect(p.role).toBe('owner');
    userRepo.listProjectsByUserId.mockResolvedValueOnce([]);
    await expect(service.createProject('u', 'X')).rejects.toThrow('PROJECT_CREATE_FAILED');
  });

  describe('members', () => {
    beforeEach(() => {
      userRepo.listProjectsByUserId.mockResolvedValue([projRecord(PROJECT_A, 'owner'), projRecord('proj_dev', 'developer')]);
    });

    it('list requires membership', async () => {
      userRepo.listProjectMembers.mockResolvedValue([{ user_id: 'u', name: 'n', email: 'e', role: 'owner', created_at: 'c' }]);
      await expect(service.listProjectMembers('u', PROJECT_A)).resolves.toHaveLength(1);
      await expect(service.listProjectMembers('u', 'proj_other')).rejects.toThrow('PROJECT_ACCESS_DENIED');
    });

    it('add/update/remove require owner', async () => {
      for (const p of ['proj_dev', 'proj_other']) {
        await expect(service.addProjectMember('u', p, 'x@y', 'developer')).rejects.toThrow('PROJECT_ACCESS_DENIED');
        await expect(service.updateMemberRole('u', p, 'm', 'owner')).rejects.toThrow('PROJECT_ACCESS_DENIED');
        await expect(service.removeMember('u', p, 'm')).rejects.toThrow('PROJECT_ACCESS_DENIED');
      }
    });

    it('add fails for unknown emails and succeeds for existing users', async () => {
      userRepo.findByEmail.mockResolvedValueOnce(undefined);
      await expect(service.addProjectMember('u', PROJECT_A, 'ghost@x', 'developer')).rejects.toThrow('USER_NOT_FOUND');
      userRepo.findByEmail.mockResolvedValueOnce({ id: 'usr_m' });
      userRepo.getProjectMember.mockResolvedValueOnce({ user_id: 'usr_m', name: 'M', email: 'm@x', role: 'developer', created_at: 'c' });
      await expect(service.addProjectMember('u', PROJECT_A, 'm@x', 'developer')).resolves.toMatchObject({ userId: 'usr_m', role: 'developer' });
      expect(userRepo.addProjectMember).toHaveBeenCalledWith(PROJECT_A, 'usr_m', 'developer');
    });

    it('cannot remove the last owner', async () => {
      userRepo.listProjectMembers.mockResolvedValue([{ user_id: 'u', role: 'owner' }, { user_id: 'd', role: 'developer' }]);
      await expect(service.removeMember('u', PROJECT_A, 'u')).rejects.toThrow('CANNOT_REMOVE_LAST_OWNER');
      await service.removeMember('u', PROJECT_A, 'd');
      expect(userRepo.removeMember).toHaveBeenCalledWith(PROJECT_A, 'd');
    });

    knownBug('KI-38', 'member roles are validated (arbitrary role strings are rejected)', async () => {
      userRepo.findByEmail.mockResolvedValueOnce({ id: 'usr_m' });
      userRepo.getProjectMember.mockResolvedValueOnce({ user_id: 'usr_m', role: 'superadmin' });
      await expect(service.addProjectMember('u', PROJECT_A, 'm@x', 'superadmin')).rejects.toThrow();
    });
  });
});

import { Writable } from 'node:stream';
import express from 'express';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger, httpLoggerOptions, redactUrl } from '@shared/utils/logger';

const SECRETS = {
  bearer: 'eyJhbGciOiJIUzI1NiJ9.access-token-secret',
  apiKey: 'pk_live_secret_api_key_value',
  rumKey: 'rum_secret_value',
  cookie: 'refresh_token=refresh-cookie-secret',
  issuedAccess: 'issued-access-token-secret',
  issuedRefresh: 'issued-refresh-token-secret',
  oauthCode: 'oauth-code-secret',
  oauthState: 'oauth-state-secret',
};

/** An app with the production HTTP logger writing into `lines`. */
function loggedApp() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(String(chunk));
      done();
    },
  });
  const logger = createLogger(sink);
  logger.level = 'info';
  const app = express();
  app.use(pinoHttp(httpLoggerOptions(logger)));
  app.get('/login', (_req, res) => {
    res.setHeader('Set-Cookie', [`refresh_token=${SECRETS.issuedRefresh}; HttpOnly`]);
    res.setHeader('X-Access-Token', SECRETS.issuedAccess);
    res.json({ ok: true });
  });
  app.get('/redirect', (_req, res) => res.redirect(`https://app.example/cb?accessToken=${SECRETS.issuedAccess}`));
  return { app, lines };
}

describe('request logging redaction (KI-35)', () => {
  it('never writes credentials from request or response headers', async () => {
    const { app, lines } = loggedApp();
    await request(app)
      .get('/login')
      .set('Authorization', `Bearer ${SECRETS.bearer}`)
      .set('x-api-key', SECRETS.apiKey)
      .set('x-rum-key', SECRETS.rumKey)
      .set('Cookie', SECRETS.cookie)
      .expect(200);

    const out = lines.join('');
    expect(out).toContain('"url":"/login"');
    for (const secret of Object.values(SECRETS)) expect(out).not.toContain(secret);
    const entry = JSON.parse(lines.at(-1)!);
    expect(entry.req.headers).toMatchObject({ authorization: '[REDACTED]', 'x-api-key': '[REDACTED]', 'x-rum-key': '[REDACTED]', cookie: '[REDACTED]' });
    expect(entry.res.headers).toMatchObject({ 'set-cookie': '[REDACTED]', 'x-access-token': '[REDACTED]' });
  });

  it('strips secret query parameters but keeps the rest of the URL', async () => {
    const { app, lines } = loggedApp();
    await request(app).get(`/login?code=${SECRETS.oauthCode}&state=${SECRETS.oauthState}&page=2`).expect(200);
    const entry = JSON.parse(lines.at(-1)!);
    expect(entry.req.url).toBe('/login?code=%5BREDACTED%5D&state=%5BREDACTED%5D&page=2');
    expect(lines.join('')).not.toContain(SECRETS.oauthCode);
  });

  it('does not log tokens carried in a redirect Location', async () => {
    const { app, lines } = loggedApp();
    await request(app).get('/redirect').expect(302);
    expect(lines.join('')).not.toContain(SECRETS.issuedAccess);
  });

  it('leaves ordinary headers readable', async () => {
    const { app, lines } = loggedApp();
    await request(app).get('/login').set('User-Agent', 'probe/1.0').expect(200);
    expect(JSON.parse(lines.at(-1)!).req.headers['user-agent']).toBe('probe/1.0');
  });
});

describe('redactUrl', () => {
  it.each([
    [undefined, undefined],
    ['/a', '/a'],
    ['/a?page=1', '/a?page=1'],
    ['/a?token=x&b=2', '/a?token=%5BREDACTED%5D&b=2'],
    ['/a?access_token=x', '/a?access_token=%5BREDACTED%5D'],
    ['/a?refreshToken=x', '/a?refreshToken=%5BREDACTED%5D'],
    ['/a?API_KEY=x', '/a?API_KEY=%5BREDACTED%5D'],
  ])('%s → %s', (input, expected) => {
    expect(redactUrl(input)).toBe(expected);
  });
});

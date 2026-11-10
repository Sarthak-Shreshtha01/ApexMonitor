import { expect, test } from '@playwright/test';
import { loginViaUi, registerViaUi, uniqueEmail } from './helpers';

test.describe('signing in and out', () => {
  test('a signed-out visitor is sent to the login page by the server, keeping the page in ?next=', async ({ page }) => {
    const response = await page.request.get('/keys', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?next=%2Fkeys');

    await page.goto('/keys');
    await expect(page).toHaveURL(/\/login\?next=%2Fkeys$/);
  });

  test('register, survive a reload without tokens in storage, sign out', async ({ page, context }) => {
    await registerViaUi(page);

    // Nothing about the session is readable by page scripts.
    const storage = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
    expect(storage).not.toMatch(/eyJ|token/i);
    const cookies = await context.cookies();
    const refresh = cookies.find((c) => c.name === 'refresh_token');
    expect(refresh?.httpOnly).toBe(true);

    // A reload restores the session from the httpOnly cookie.
    await page.reload();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Signed out for real: the cookie is gone and dashboard pages redirect again.
    expect((await context.cookies()).find((c) => c.name === 'refresh_token')).toBeUndefined();
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login/);
  });

  test('after signing in, the user lands on the page they asked for', async ({ page, browser }) => {
    const email = await registerViaUi(page);

    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto('/alerts');
    await expect(other).toHaveURL(/\/login\?next=%2Falerts$/);
    await loginViaUi(other, email);
    await expect(other).toHaveURL(/\/alerts$/);
    await fresh.close();
  });

  test('a wrong password shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await loginViaUi(page, uniqueEmail('nobody'));
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

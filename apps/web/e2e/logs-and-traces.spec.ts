import { expect, test } from '@playwright/test';
import { createProjectAndKeyViaUi, ingest, registerViaUi, selectProject } from './helpers';

test('logs list ingested requests, filter by status, and open the trace of a request', async ({ page }) => {
  await registerViaUi(page);
  const projectName = `Logs ${Date.now()}`;
  const apiKey = await createProjectAndKeyViaUi(page, projectName, 'logs key');
  await selectProject(page, projectName);

  await ingest(page.request, apiKey, [
    { endpoint: '/api/catalog', latencyMs: 30 },
    { endpoint: '/api/cart', latencyMs: 45 },
    { method: 'POST', endpoint: '/api/payments', statusCode: 502, latencyMs: 310 },
  ]);

  await page.goto('/logs');
  // Raw logs are written by a queue worker, so poll until all three are in.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Showing 3 of 3 logs')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });

  await page.getByLabel('Status').selectOption('5xx');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page.getByText('Showing 1 of 1 logs')).toBeVisible();
  const row = page.getByRole('row', { name: /\/api\/payments/ });
  await expect(row).toContainText('502');
  await expect(row).toContainText('POST');

  await row.click();
  await page.getByRole('link', { name: 'View Trace' }).click();
  await expect(page).toHaveURL(/\/traces\/[^/]+$/);
  const traceId = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.getByRole('heading', { name: traceId })).toBeVisible();
  await expect(page.getByText('POST /api/payments').first()).toBeVisible();
  await expect(page.getByText('Status: 502')).toBeVisible();

  // The trace explorer lists the same requests.
  await page.getByRole('link', { name: 'Back to Trace Explorer' }).click();
  await expect(page).toHaveURL(/\/traces$/);
  await expect(page.getByRole('row', { name: /\/api\/payments/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /\/api\/catalog/ })).toBeVisible();
});

test('an unknown trace id shows Trace Not Found', async ({ page }) => {
  await registerViaUi(page);
  const lookup = page.waitForResponse((r) => r.url().includes('/api/v1/traces/00000000-0000-4000-8000-000000000000'));
  await page.goto('/traces/00000000-0000-4000-8000-000000000000');
  // The page must actually ask the API (it used to give up without a request).
  expect((await lookup).status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Trace Not Found' })).toBeVisible();
});

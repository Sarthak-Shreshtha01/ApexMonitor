import { expect, test } from '@playwright/test';
import { API_URL, createProjectAndKeyViaUi, ingest, registerViaUi, selectProject } from './helpers';

test('create a project and key, send traffic, see it on the overview, revoke the key', async ({ page }) => {
  await registerViaUi(page);
  const projectName = `Checkout ${Date.now()}`;
  const apiKey = await createProjectAndKeyViaUi(page, projectName);
  await selectProject(page, projectName);

  await ingest(page.request, apiKey, [
    { endpoint: '/api/orders/123', latencyMs: 40 },
    { endpoint: '/api/orders/456', latencyMs: 60 },
    { endpoint: '/api/orders/789', latencyMs: 80 },
    { method: 'POST', endpoint: '/api/payments', statusCode: 500, latencyMs: 300 },
    { endpoint: '/health', latencyMs: 2 },
  ]);

  await page.getByRole('link', { name: /overview/i }).first().click();
  await expect(page).toHaveURL(/\/overview$/);
  // Aggregation is asynchronous (queue → worker → Postgres); the page refreshes itself.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Computed from 5 requests', { exact: false })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  // IDs in paths are normalised, so the three order requests are one endpoint.
  await expect(page.getByRole('cell', { name: '/api/orders/:id' })).toBeVisible();

  // Revoking the key stops ingest immediately.
  await page.goto('/keys');
  const section = page.locator('section', { has: page.getByRole('heading', { name: projectName }) }).last();
  await section.getByRole('button', { name: 'Revoke key e2e key' }).locator('visible=true').first().click();
  // Scoped to this project: the default project's section shows the same empty message.
  await expect(section.getByText('No keys yet for this project.')).toBeVisible();
  const refused = await page.request.post(`${API_URL}/api/v1/ingest`, {
    headers: { 'x-api-key': apiKey },
    data: { logs: [{ method: 'GET', endpoint: '/x', statusCode: 200, latencyMs: 1, timestamp: new Date().toISOString() }] },
  });
  expect(refused.status()).toBe(401);
});

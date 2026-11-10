import { expect, test } from '@playwright/test';
import { createProjectAndKeyViaUi, ingest, registerViaUi, selectProject } from './helpers';

test('live traffic joins the project room and receives pulses for new requests', async ({ page }) => {
  await registerViaUi(page);
  const projectName = `Live ${Date.now()}`;
  const apiKey = await createProjectAndKeyViaUi(page, projectName);
  await selectProject(page, projectName);

  const frames: string[] = [];
  page.on('websocket', (ws) => ws.on('framereceived', (f) => frames.push(String(f.payload))));

  await page.goto('/live-traffic');
  // LIVE appears only after the server accepted the join (token + membership).
  await expect(page.getByText('LIVE', { exact: true }).first()).toBeVisible();
  expect(frames.some((f) => f.includes('join:error'))).toBe(false);

  await ingest(page.request, apiKey, Array.from({ length: 10 }, () => ({ endpoint: '/api/live-check' })));
  await expect
    .poll(() => frames.some((f) => f.includes('pulse:live') && f.includes('/api/live-check')), { timeout: 15_000 })
    .toBe(true);
});

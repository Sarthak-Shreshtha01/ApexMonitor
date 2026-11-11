import { expect, test } from '@playwright/test';
import { registerViaUi } from './helpers';

test('create, pause, resume and delete an alert rule', async ({ page }) => {
  await registerViaUi(page);
  await page.goto('/alerts');
  await expect(page.getByText('No alert rules yet. Create one below.')).toBeVisible();

  await page.getByLabel('Name').fill('Slow checkout');
  await page.getByLabel('Metric').selectOption('latency_p99_high');
  await page.getByLabel('Fires when above').fill('750');
  await page.getByLabel('Over the last').selectOption('15');
  await page.getByLabel('Endpoint (optional)').fill('/api/checkout');
  await page.getByRole('button', { name: 'Save Alert Rule' }).click();
  await expect(page.getByText('Rule saved.')).toBeVisible();

  await expect(page.getByText('Slow checkout')).toBeVisible();
  await expect(page.getByText('p99 latency > 750ms over 15 min on /api/checkout')).toBeVisible();
  await expect(page.getByText('OK', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('OK', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Delete Slow checkout' }).click();
  await expect(page.getByText('No alert rules yet. Create one below.')).toBeVisible();
});

test('the API rejects a webhook that points at a private address', async ({ page }) => {
  await registerViaUi(page);
  await page.goto('/alerts');
  await page.getByLabel('Name').fill('Internal hook');
  await page.getByLabel('Webhook (optional)').fill('https://127.0.0.1/hook');
  await page.getByRole('button', { name: 'Save Alert Rule' }).click();
  await expect(page.getByRole('status')).not.toContainText('Rule saved.');
  await expect(page.getByRole('status').locator('.text-error')).toBeVisible();
  await expect(page.getByText('No alert rules yet. Create one below.')).toBeVisible();
});

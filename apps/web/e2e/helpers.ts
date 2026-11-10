import { APIRequestContext, expect, Page } from '@playwright/test';
import { API_URL } from '../playwright.config';

export { API_URL };

export const PASSWORD = 'Correct-Horse-9-battery';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Fills in the sign-up form and waits for the overview. */
export async function registerViaUi(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto('/register');
  await page.getByPlaceholder('John Doe').fill('E2E User');
  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /create account|sign up|register/i }).click();
  await expect(page).toHaveURL(/\/overview$/);
  return email;
}

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.getByPlaceholder('dev@apexMonitor.tech').fill(email);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

/** Creates a project and an ingest key through the Keys page; returns the plaintext key. */
export async function createProjectAndKeyViaUi(page: Page, projectName: string, keyLabel = 'e2e key'): Promise<string> {
  await page.goto('/keys');
  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByPlaceholder('Production-Alpha').fill(projectName);
  await page.getByRole('button', { name: 'Create Project' }).click();

  const section = page.locator('section', { has: page.getByRole('heading', { name: projectName, exact: false }) }).last();
  await section.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('Main Gateway Primary').fill(keyLabel);
  await page.getByRole('button', { name: 'Generate Key' }).click();

  // The plaintext is shown once, right after generation.
  // Each key is rendered twice (mobile and desktop layouts); use the one on screen.
  const plaintext = section.locator('code:visible', { hasText: /^pk_/ }).first();
  await expect(plaintext).toBeVisible();
  const key = (await plaintext.textContent())?.trim() ?? '';
  expect(key).toMatch(/^pk_(live|test)_[A-Za-z0-9_-]+$/);
  return key;
}

/** Picks the active project in the navbar switcher. */
export async function selectProject(page: Page, projectName: string): Promise<void> {
  const switcher = page.getByRole('banner').getByRole('combobox');
  await switcher.selectOption({ label: projectName });
  await expect(switcher.locator('option:checked')).toHaveText(projectName);
}

export interface FakeRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  statusCode?: number;
  latencyMs?: number;
}

/** Sends a batch of request logs to the ingest API, the way an SDK would. */
export async function ingest(request: APIRequestContext, apiKey: string, logs: FakeRequest[]): Promise<void> {
  const now = new Date().toISOString();
  const res = await request.post(`${API_URL}/api/v1/ingest`, {
    headers: { 'x-api-key': apiKey },
    data: {
      sdkVersion: '1.0.0',
      logs: logs.map((l) => ({
        method: l.method ?? 'GET',
        endpoint: l.endpoint,
        statusCode: l.statusCode ?? 200,
        latencyMs: l.latencyMs ?? 42,
        ip: '203.0.113.7',
        userAgent: 'e2e',
        timestamp: now,
      })),
    },
  });
  expect(res.status(), await res.text()).toBe(202);
}

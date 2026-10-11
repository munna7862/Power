import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __APEX__: { advanceDays(days: number): void };
  }
}

/** Opens the app with empty storage. */
export async function openFresh(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Apex Sovereign' })).toBeVisible();
}

export async function startGame(page: Page, name = 'Asha Rao', difficulty = 'Normal'): Promise<void> {
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByLabel("President's name").fill(name);
  await page.getByRole('radio', { name: new RegExp(difficulty) }).check();
  await page.getByRole('button', { name: 'Begin term' }).click();
  await expect(page.getByTestId('game-date')).toBeVisible();
}

/** Fast-forwards the simulation through the dev-only debug hook (not present in production builds). */
export async function advanceDays(page: Page, days: number): Promise<void> {
  await page.evaluate((d) => window.__APEX__.advanceDays(d), days);
}

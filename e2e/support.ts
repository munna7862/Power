import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __APEX__: {
      advanceDays(days: number): void;
      raiseEvent(eventId: string, region?: string): void;
      getState(): { game: { clock: { tick: number }; military: { rivals: Record<string, Record<string, unknown>> } } };
      invade(rival: string): void;
      offerCeasefire(): void;
      patchGame(patch: { nation?: object; economy?: object; security?: object; military?: object }): void;
    };
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

/** Overrides parts of the game state through the dev-only debug hook. */
export async function patchGame(
  page: Page,
  patch: { nation?: object; economy?: object; security?: object; military?: object },
): Promise<void> {
  await page.evaluate((p) => window.__APEX__.patchGame(p), patch);
}

export async function openView(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Raises a specific event now through the dev-only debug hook. */
export async function raiseEvent(page: Page, eventId: string, region?: string): Promise<void> {
  await page.evaluate(
    ([id, r]) => window.__APEX__.raiseEvent(id as string, r as string | undefined),
    [eventId, region],
  );
}

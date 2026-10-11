import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __APEX__: {
      advanceDays(days: number): void;
      raiseEvent(eventId: string, region?: string, ref?: string): void;
      getState(): { game: { clock: { tick: number }; military: { rivals: Record<string, Record<string, unknown>> } } };
      invade(rival: string): void;
      offerCeasefire(): void;
      patchGame(patch: {
        nation?: object;
        economy?: object;
        security?: object;
        military?: object;
        diplomacy?: object;
      }): void;
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

/** Starts a new game. The guided tutorial is off unless a test asks for it, so it never gets in the way. */
export async function startGame(
  page: Page,
  name = 'Asha Rao',
  difficulty = 'Normal',
  options: { tutorial?: boolean; noWars?: boolean; noRiots?: boolean } = {},
): Promise<void> {
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByLabel("President's name").fill(name);
  await page.getByRole('radio', { name: new RegExp(difficulty) }).check();
  await page.getByRole('checkbox', { name: /Guided tutorial/ }).setChecked(options.tutorial ?? false);
  await page.getByRole('checkbox', { name: /No wars/ }).setChecked(options.noWars ?? false);
  await page.getByRole('checkbox', { name: /No riots/ }).setChecked(options.noRiots ?? false);
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
  patch: { nation?: object; economy?: object; security?: object; military?: object; diplomacy?: object },
): Promise<void> {
  await page.evaluate((p) => window.__APEX__.patchGame(p), patch);
}

export async function openView(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Raises a specific event now through the dev-only debug hook. */
export async function raiseEvent(page: Page, eventId: string, region?: string, ref?: string): Promise<void> {
  await page.evaluate(
    ([id, r, c]) => window.__APEX__.raiseEvent(id as string, r as string | undefined, c as string | undefined),
    [eventId, region, ref],
  );
}

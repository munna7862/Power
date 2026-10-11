import { expect, test } from '@playwright/test';
import { openFresh, startGame } from './support';

// Runs in the "chrome-narrow" project (768 px wide) via the @responsive tag.
test('@responsive navigation collapses to a bottom tab bar at 768 px', async ({ page }) => {
  await openFresh(page);
  await startGame(page);

  const viewport = page.viewportSize();
  const nav = await page.getByTestId('nav').boundingBox();
  expect(viewport && nav).toBeTruthy();
  if (!viewport || !nav) return;

  expect(nav.y).toBeGreaterThan(viewport.height / 2);
  expect(nav.width).toBeGreaterThan(viewport.width * 0.9);
  await expect(page.getByTestId('topbar-treasury')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

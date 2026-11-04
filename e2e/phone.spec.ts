import { expect, test } from '@playwright/test';
import { openFresh, startGame } from './support';

// Runs in the "chrome-phone" project (412 × 915, touch) via the @phone tag: the layout the Android app uses.

/** Sideways overflow of the page, and the controls on screen a fingertip would struggle to hit. */
const audit = () =>
  ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    small: [...document.querySelectorAll('button, [role=button], input, select, summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // "Why?" chips stay small and get an invisible 44 px hit area instead.
        return r.width > 0 && r.height > 0 && r.height < 44 && !el.closest('[class*="tooltipWrap"]');
      })
      .map((el) => (el.textContent ?? '').trim().slice(0, 30)),
  }) as const;

test('@phone every screen fits a phone, with finger-sized controls', async ({ page }) => {
  await openFresh(page);
  expect(await page.evaluate(audit)).toEqual({ overflow: 0, small: [] });
  await startGame(page);

  const tabs = page.getByTestId('nav').getByRole('button');
  const count = await tabs.count();
  expect(count).toBeGreaterThan(10);
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    await tab.tap();
    await expect(tab).toHaveAttribute('aria-current', 'page');
    const name = await tab.textContent();
    expect(await page.evaluate(audit), `the ${name} screen`).toEqual({ overflow: 0, small: [] });
  }
});

test('@phone a "Why?" breakdown opens on tap and stays on screen', async ({ page }) => {
  await openFresh(page);
  await startGame(page);
  const why = page.getByRole('button', { name: 'Why?' }).first();
  await why.tap();
  const bubble = page.getByRole('tooltip').first();
  await expect(bubble).toBeVisible();
  const box = await bubble.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport).toBeTruthy();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

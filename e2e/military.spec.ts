import { expect, test, type Page } from '@playwright/test';
import { advanceDays, openFresh, openView, patchGame, startGame } from './support';

/** Keeps a long fast-forward from ending the term early (the demo is about the army, not about politics). */
const steady = (page: Page) => patchGame(page, { nation: { approval: 90 }, security: { militaryLoyalty: 100 } });

const openTab = async (page: Page, name: string) => {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('tabpanel')).toBeVisible();
};

test.describe('Commander-in-Chief (Phase 4, milestone M4)', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await openView(page, 'Military');
  });

  test('builds up the air force: orders are paid from the procurement fund and delivered', async ({ page }) => {
    await expect(page.getByTestId('strength-index')).toHaveText(/^\d+$/);
    const before = Number(await page.getByTestId('count-fighter').textContent());
    const fund = await page.getByTestId('procurement-fund').textContent();

    await page.getByRole('button', { name: 'Order 1 Fighter Squadron' }).click();
    await expect(page.getByTestId('procurement-fund')).not.toHaveText(fund ?? '');
    const queue = page.getByRole('list', { name: 'Production queue' });
    await expect(queue).toContainText('1 × Fighter Squadron');

    await steady(page);
    await advanceDays(page, 300);
    await expect(page.getByTestId('count-fighter')).toHaveText(String(before + 1));
    await expect(page.getByRole('list', { name: 'Production queue' })).toHaveCount(0);

    // Research the next air tier.
    await page.getByRole('button', { name: 'Research Air tier 2' }).click();
    await expect(page.getByText(/Researching tier 2: \d+ days left/)).toBeVisible();
  });

  test('runs a joint drill and reads the result card', async ({ page }) => {
    await openTab(page, 'Drills');
    await page.getByRole('button', { name: 'Start joint exercise' }).click();
    await expect(page.getByRole('progressbar', { name: 'Joint exercise progress' })).toBeVisible();

    await steady(page);
    await advanceDays(page, 50);
    const reports = page.getByRole('list', { name: 'Drill reports' });
    await expect(reports).toContainText('Joint exercise');
    await expect(reports).toContainText(/Readiness \+\d/);
  });

  test('recon: enemy strength is a rough estimate until a sighting sharpens it', async ({ page }) => {
    await openTab(page, 'Drills');
    const CHN = page.getByTestId('strength-CHN');
    await expect(CHN).toContainText('rough estimate');

    await page.getByRole('button', { name: 'Recon China' }).click();
    await expect(page.getByRole('list', { name: 'Intelligence operations' })).toContainText('Recon: China');

    // The operation can succeed, fail quietly or be exposed: the outcome always reaches the inbox.
    await steady(page);
    await advanceDays(page, 35);
    await openView(page, 'Inbox');
    await expect(page.getByRole('list', { name: 'Inbox messages' })).toContainText(/China/);
  });

  test('a recon sighting shows a narrow range that widens as it ages', async ({ page }) => {
    await page.evaluate(() => {
      const { game } = window.__APEX__.getState();
      const military = game.military;
      window.__APEX__.patchGame({
        military: {
          rivals: {
            ...military.rivals,
            BGD: { ...military.rivals.BGD, sighting: { tick: game.clock.tick, strength: 26, readiness: 70 } },
          },
        },
      });
    });
    await openTab(page, 'Drills');
    await expect(page.getByTestId('strength-BGD')).toContainText(/\d+–\d+ \(recon 0 days old\)/);
    await steady(page);
    await advanceDays(page, 200);
    await expect(page.getByTestId('strength-BGD')).toContainText('recon 200 days old');
  });

  test('defends against an invasion and negotiates a ceasefire', async ({ page }) => {
    await openView(page, 'Dashboard');
    await page.evaluate(() => window.__APEX__.invade('CHN'));
    const banner = page.getByRole('region', { name: 'War' });
    await expect(banner).toContainText('At war with China');

    await banner.getByRole('button', { name: 'War room' }).click();
    await openTab(page, 'War');
    const war = page.getByRole('article', { name: 'War with China' });
    await expect(war).toBeVisible();
    await expect(war.getByRole('list', { name: 'Fronts' })).toContainText('Northern mountain front');

    await steady(page);
    await advanceDays(page, 20);
    await expect(war).toContainText('Daily report');
    await expect(war.getByRole('progressbar', { name: 'War weariness' })).toBeVisible();
    await expect(war.getByRole('button', { name: 'Accept ceasefire' })).toHaveCount(0);

    await page.evaluate(() => window.__APEX__.offerCeasefire());
    await war.getByRole('button', { name: 'Accept ceasefire' }).click();
    await expect(war).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Past wars' })).toContainText('China: ceasefire');
  });

  test('declares war on a small neighbour (with a confirmation), wins and annexes it', async ({ page }) => {
    await openTab(page, 'War');
    await page.getByRole('button', { name: 'Declare war on Sri Lanka' }).click();
    const dialog = page.getByRole('dialog', { name: 'Declare war on Sri Lanka?' });
    await expect(dialog).toContainText('Mobilisation costs');
    await dialog.getByRole('button', { name: 'Declare war' }).click();

    const war = page.getByRole('article', { name: 'War with Sri Lanka' });
    await expect(war).toBeVisible();
    await steady(page);
    await advanceDays(page, 50);
    await expect(war).toContainText('Sri Lanka has capitulated');
    await war.getByRole('button', { name: 'Annex Sri Lanka' }).click();
    await expect(war).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Past wars' })).toContainText('Sri Lanka: victory');
    await expect(page.getByRole('button', { name: 'Declare war on Sri Lanka' })).toBeDisabled();
  });

  test('the nuclear program, doctrine and the consequences of use', async ({ page }) => {
    await openTab(page, 'Nuclear');
    await page.getByRole('button', { name: /Launch the program/ }).click();
    await expect(page.getByTestId('nuclear-stage')).toContainText('Research');
    await expect(page.getByRole('button', { name: 'Pause the program' })).toBeVisible();

    await patchGame(page, {
      military: {
        nuclear: {
          active: true,
          research: 100,
          enrichment: 100,
          warheads: 2,
          doctrine: 'noFirstUse',
          monthsSinceWarhead: 0,
        },
      },
    });
    await expect(page.getByTestId('warheads')).toHaveText('2');

    await openTab(page, 'War');
    await page.getByRole('button', { name: 'Declare war on Pakistan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Declare war' }).click();

    await openTab(page, 'Nuclear');
    const strike = page.getByRole('button', { name: 'Use nuclear weapon against Pakistan' });
    await expect(strike).toBeDisabled();
    await page.getByRole('radio', { name: /First use reserved/ }).check();
    await strike.click();
    const dialog = page.getByRole('dialog', { name: 'Order a nuclear strike?' });
    await expect(dialog).toContainText('Global sanctions for five years');
    await dialog.getByRole('button', { name: 'Confirm the strike' }).click();

    await expect(page.getByTestId('warheads')).toHaveText('1');
    await openView(page, 'Inbox');
    await expect(page.getByRole('list', { name: 'Inbox messages' })).toContainText('Nuclear weapon used');
  });
});

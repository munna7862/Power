import { expect, test } from '@playwright/test';
import { advanceDays, openFresh, openView, patchGame, raiseEvent, startGame } from './support';

test.describe('crises and security (Phase 3)', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await startGame(page);
  });

  test('a flood hits the East, the banner appears and a relief response is chosen', async ({ page }) => {
    await raiseEvent(page, 'flood-river', 'east');
    const banner = page.getByRole('region', { name: 'Pending decisions' });
    await expect(banner).toContainText('1 decision awaiting the President');

    await banner.getByRole('button', { name: 'Review' }).click();
    const dialog = page.getByRole('dialog', { name: 'River floods in the East' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'Effects of Announce a large relief package' })).toContainText(
      'Costs',
    );
    await dialog.getByRole('button', { name: 'Choose: Announce a large relief package' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Pending decisions' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Inbox messages' })).toContainText(
      'A generous relief package is announced',
    );
  });

  test('Review opens the most urgent decision and stops the clock while it is open (DEF-03)', async ({ page }) => {
    // An older decision with a month to decide, then a flood with ten days.
    await raiseEvent(page, 'procurement-scam');
    await raiseEvent(page, 'flood-river', 'east');
    await page.getByRole('button', { name: 'Speed 4×' }).click();
    await expect(page.getByRole('button', { name: 'Speed 4×' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('region', { name: 'Pending decisions' }).getByRole('button', { name: 'Review' }).click();
    await expect(page.getByRole('dialog', { name: 'River floods in the East' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const date = await page.getByTestId('game-date').textContent();
    // Deliberate wait: at 4× ten days would pass in 2.5 seconds if the clock were still running.
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('game-date')).toHaveText(date ?? '');
    await expect(page.getByRole('dialog', { name: 'River floods in the East' })).toBeVisible();
  });

  test('the inbox filters by category and decisions', async ({ page }) => {
    await raiseEvent(page, 'officials-scandal');
    await raiseEvent(page, 'bumper-harvest');
    await openView(page, 'Inbox');
    const list = page.getByRole('list', { name: 'Inbox messages' });
    const filters = page.getByRole('group', { name: 'Inbox filters' });
    await filters.getByRole('button', { name: 'Corruption' }).click();
    await expect(list).toContainText('Allegations against officials');
    await expect(list).not.toContainText('Bumper harvest');
    await filters.getByRole('button', { name: /^Decisions/ }).click();
    await expect(list).toContainText('Allegations against officials');
    await filters.getByRole('button', { name: 'Economy' }).click();
    await expect(list).toContainText('Bumper harvest');
  });

  test('the Security screen shows unrest and crime by region; operations and audits run from the Police screen', async ({
    page,
  }) => {
    await patchGame(page, {
      security: { unrest: { east: 80, north: 20, south: 20, west: 20, central: 20, northEast: 20 } },
    });
    await openView(page, 'Security');
    await expect(page.getByRole('img', { name: /Unrest by region/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /East 80/ })).toContainText('80');

    await page.getByRole('button', { name: 'Why East?' }).hover();
    await expect(page.getByRole('tooltip').first()).toContainText('Policing and order');
    await page.getByRole('button', { name: 'Crime', exact: true }).click();
    await expect(page.getByRole('img', { name: /Crime by region/ })).toBeVisible();
    await page.getByRole('button', { name: 'Why crime in the East?' }).hover();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Police on the street' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Threats to your presidency' })).toContainText('Coup');

    await page.getByRole('button', { name: 'Police, operations and audits' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Police' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand surveillance' }).click();
    await expect(page.getByText(/Active: \d+ days/)).toBeVisible();

    await page.getByRole('button', { name: 'Audit Home Affairs' }).click();
    await expect(page.getByText(/Reports in \d+ days/)).toBeVisible();
  });

  test('the Police screen recruits officers, houses them, funds an agency and shows the civil-liberties cost', async ({
    page,
  }) => {
    await openView(page, 'Police');
    const east = page.getByTestId('police-east');
    await expect(east).toContainText('Strength 100%');

    await east.getByRole('spinbutton').fill('200000');
    await east.getByRole('button', { name: /^Recruit 200000 officers in the East/ }).click();
    await expect(east).toContainText(/Strength 1\d\d%/);
    await expect(page.getByTestId('civil-liberties')).toContainText('−');
    await east.getByRole('button', { name: /^Build \d+ stations in the East/ }).click();
    await expect(east.getByRole('button', { name: /^Build \d+ stations/ })).toHaveCount(0);

    const intelligence = page.getByTestId('agency-intelligenceService');
    await intelligence.getByRole('button', { name: /^Raise the intelligence service to 55/ }).click();
    await expect(intelligence).toContainText('Strength 55');
    await expect(page.getByTestId('police-running-costs')).toContainText('Home Affairs');
    await expect(page.getByTestId('police-running-costs')).toContainText('Intelligence');
  });

  test('the clock pauses itself when a critical event arrives', async ({ page }) => {
    await page.getByRole('button', { name: 'Speed 4×' }).click();
    await patchGame(page, { security: { terrorThreat: 100 } });
    // A decision or a critical report will arrive within a few in-game months; the clock must stop on its own.
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true', {
      timeout: 60_000,
    });
  });

  test('a collapse in army loyalty ends in a coup', async ({ page }) => {
    // Keep the collapse going month after month: either the generals move or Parliament impeaches.
    for (let month = 0; month < 12; month++) {
      await patchGame(page, { nation: { approval: 0 }, security: { militaryLoyalty: 0 } });
      await advanceDays(page, 30);
    }
    const dialog = page.getByRole('dialog', { name: /Overthrown in a coup|Impeached/ });
    await expect(dialog).toBeVisible();
  });
});

import { expect, test, type Page } from '@playwright/test';
import { advanceDays, openFresh, openView, patchGame, startGame } from './support';

/** Plays to election day with approval held high, so the President wins a second term. */
async function winTerm(page: Page): Promise<void> {
  for (let day = 0; day < 1826; day += 25) {
    await patchGame(page, { nation: { approval: 80 }, security: { militaryLoyalty: 90, terrorThreat: 5 } });
    await advanceDays(page, Math.min(25, 1826 - day));
  }
}

test.describe('Phase 6: polish and release', () => {
  test('the guided tutorial walks through the first month and is off by default afterwards', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: 'New Game' }).click();
    await expect(page.getByRole('checkbox', { name: /Guided tutorial/ })).toBeChecked();
    await page.getByRole('button', { name: 'Begin term' }).click();

    const coach = page.getByTestId('tutorial');
    await expect(coach).toContainText('Welcome');
    await coach.getByRole('button', { name: 'Next' }).click();
    await coach.getByRole('button', { name: 'Next' }).click();
    await expect(coach).toContainText('Open the budget');
    await expect(
      page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Budget' }),
    ).toHaveAttribute('data-tutorial', 'true');
    await page.keyboard.press('F4');
    await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible();
    await coach.getByRole('button', { name: 'Next' }).click();
    await openView(page, 'Departments');
    await coach.getByRole('button', { name: 'Next' }).click();
    await expect(coach).toContainText('Start the clock');
    await page.getByRole('button', { name: 'Speed 4×' }).click();
    // The practice decision arrives on day 4 and pauses the clock.
    await expect(coach).toContainText('Make the call', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Review' }).click();
    await page.getByRole('button', { name: /Choose: Issue a crop advisory/ }).click();
    await expect(coach).toContainText('The world stage');
    await openView(page, 'World');
    await coach.getByRole('button', { name: 'Next' }).click();
    await expect(coach).toContainText('The nation is yours');
    await coach.getByRole('button', { name: 'Take office' }).click();
    await expect(coach).toHaveCount(0);

    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Quit to main menu' }).click();
    await page.getByRole('button', { name: 'New Game' }).click();
    await expect(page.getByRole('checkbox', { name: /Guided tutorial/ })).not.toBeChecked();
  });

  test('accessibility settings apply at once and survive a reload', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('button', { name: '125%' }).click();
    await dialog.getByRole('button', { name: 'Colour-blind safe' }).click();
    await dialog.getByRole('button', { name: 'Reduced' }).click();
    await dialog.getByRole('button', { name: 'Light' }).click();
    await dialog.getByRole('slider', { name: 'Music' }).fill('20');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-palette', 'colourBlind');
    await expect(html).toHaveAttribute('data-motion', 'reduced');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(html).toHaveAttribute('style', /zoom: 1.25/);

    await page.reload();
    await expect(html).toHaveAttribute('data-palette', 'colourBlind');
    await expect(html).toHaveAttribute('style', /zoom: 1.25/);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('slider', { name: 'Music' })).toHaveValue('20');
    await expect(page.getByRole('button', { name: 'Reduced' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('keyboard shortcuts switch screens, set the speed, pause and open the handbook and menu', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await page.keyboard.press('F3');
    await expect(page.getByRole('heading', { level: 1, name: 'Economy' })).toBeVisible();
    await page.keyboard.press('F10');
    await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
    await page.keyboard.press('2');
    await expect(page.getByRole('button', { name: 'Speed 2×' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('h');
    const handbook = page.getByRole('dialog', { name: 'The Constitution' });
    await expect(handbook).toBeVisible();
    await handbook.getByRole('searchbox').fill('fatigue');
    await expect(handbook.getByRole('heading', { name: 'Winning: re-election' })).toBeVisible();
    await expect(handbook.getByRole('heading', { name: 'Taxes' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(handbook).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Game menu' })).toBeVisible();
  });

  test('winning the election ends the term in victory, and endless mode carries on (F20)', async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Asha Rao', 'Normal', { noWars: true });
    await expect(page.getByTestId('election-note')).toContainText('Election on 1 January');
    await winTerm(page);

    const verdict = page.getByRole('dialog', { name: 'Re-elected' });
    await expect(verdict).toBeVisible();
    await expect(verdict.getByTestId('game-over-verdict')).toHaveText('Victory');
    await verdict.getByRole('button', { name: 'Stay in office (endless)' }).click();
    await expect(verdict).toHaveCount(0);
    await expect(page.getByTestId('election-note')).toContainText('No more elections');
    const date = await page.getByTestId('game-date').textContent();
    await advanceDays(page, 40);
    await expect(page.getByTestId('game-date')).not.toHaveText(date ?? '');
  });

  test('a President who reaches election day short of approval is voted out', async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Asha Rao', 'Normal', { noWars: true });
    for (let day = 0; day < 1826; day += 25) {
      await patchGame(page, { nation: { approval: 35 }, security: { militaryLoyalty: 90, terrorThreat: 5 } });
      await advanceDays(page, Math.min(25, 1826 - day));
    }
    const verdict = page.getByRole('dialog', { name: 'Voted out' });
    await expect(verdict).toBeVisible();
    await expect(verdict.getByTestId('game-over-verdict')).toHaveText('Presidency over');
    await expect(verdict.getByRole('button', { name: 'Stay in office (endless)' })).toHaveCount(0);
  });

  test('"No wars" switches war off for the whole game', async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Asha Rao', 'Normal', { noWars: true });
    await openView(page, 'Military');
    await page.getByRole('tab', { name: 'War' }).click();
    await expect(page.getByText(/Wars are switched off for this game/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Declare war on Sri Lanka' })).toBeDisabled();
  });
});

import { expect, test } from '@playwright/test';
import { advanceDays, openFresh, patchGame, startGame } from './support';

const year = new Date().getFullYear();

test.describe('playing the game', () => {
  test('a new game starts paused on 1 January with the chosen president', async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Asha Rao', 'Hard');

    await expect(page.getByTestId('game-date')).toHaveText(`1 Jan ${year}`);
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('President Asha Rao')).toBeVisible();
    await expect(page.getByText('Sworn in as President')).toBeVisible();
  });

  test('time runs at the selected speed and pauses again', async ({ page }) => {
    await openFresh(page);
    await startGame(page);

    await page.getByRole('button', { name: 'Speed 4×' }).click();
    await expect(page.getByTestId('game-date')).not.toHaveText(`1 Jan ${year}`, { timeout: 5_000 });

    await page.getByRole('button', { name: 'Pause' }).click();
    const paused = await page.getByTestId('game-date').textContent();
    await page.waitForTimeout(1_000); // deliberate: proves the clock stays still while paused
    await expect(page.getByTestId('game-date')).toHaveText(paused ?? '');
  });

  test('Space toggles pause', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Speed 1×' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the treasury settles monthly and the inbox reports the year', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await expect(page.getByText(/first monthly settlement arrives/)).toBeVisible();

    await advanceDays(page, 31);
    await expect(page.getByTestId('game-date')).toHaveText(`1 Feb ${year}`);
    await expect(page.getByText(new RegExp(`^[+−]₹.* in Jan ${year}$`))).toBeVisible();
    await expect(page.getByText(/first monthly settlement arrives/)).toHaveCount(0);

    // Start popular so the crises of a hands-off first year cannot end the game before the report.
    await patchGame(page, { nation: { approval: 95 } });
    await advanceDays(page, 334);
    await expect(page.getByText(`Annual report ${year}`)).toBeVisible();
  });

  test('the approval "Why?" tooltip shows voter scores and adjustments', async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Asha Rao', 'Hard');
    await page.getByRole('button', { name: 'Why?' }).hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Jobs (20%)');
    await expect(tooltip).toContainText('Difficulty: Hard');
    await expect(tooltip).toContainText('−5');
    await expect(tooltip).toContainText('Ideology: Liberalism');
  });

  test('the dashboard lists the top three issues', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await expect(page.getByRole('list', { name: 'Top issues' }).getByRole('listitem')).toHaveCount(3);
  });
});

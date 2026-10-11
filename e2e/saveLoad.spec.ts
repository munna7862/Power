import { expect, test } from '@playwright/test';
import { advanceDays, openFresh, startGame } from './support';

test.describe('save and load (M1 demo)', () => {
  test('save to a slot, reload the browser, load, and resume at the same date and treasury', async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Vikram Sen');
    await advanceDays(page, 95);

    const date = await page.getByTestId('game-date').textContent();
    const treasury = await page.getByTestId('topbar-treasury').textContent();

    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Save game' }).click();
    await page.getByRole('button', { name: 'Save to Slot 2' }).click();
    await expect(page.getByRole('status')).toHaveText(/Game saved/);

    await page.reload();
    await page.getByRole('button', { name: 'Load Game' }).click();
    const dialog = page.getByRole('dialog', { name: 'Load game' });
    await expect(dialog).toContainText(`Vikram Sen · ${date}`);
    await dialog.getByRole('button', { name: 'Load Slot 2' }).click();

    await expect(page.getByTestId('game-date')).toHaveText(date ?? '');
    await expect(page.getByTestId('topbar-treasury')).toHaveText(treasury ?? '');
    await expect(page.getByText('President Vikram Sen')).toBeVisible();
  });

  test('autosaves monthly so Continue resumes after a reload', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await advanceDays(page, 40);
    const date = await page.getByTestId('game-date').textContent();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('game-date')).toHaveText(date ?? '');
  });

  test('quitting to the main menu keeps saves available', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await advanceDays(page, 31);
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Quit to main menu' }).click();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});

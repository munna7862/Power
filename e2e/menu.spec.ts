import { expect, test } from '@playwright/test';
import { openFresh } from './support';

test.describe('main menu', () => {
  test('shows the title and disables Continue/Load without saves', async ({ page }) => {
    await openFresh(page);
    await expect(page).toHaveTitle('India: Apex Sovereign');
    await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Load Game' })).toBeDisabled();
    // The browser build cannot quit; the Electron build (Phase 6) will add the button.
    await expect(page.getByRole('button', { name: 'Quit' })).toHaveCount(0);
  });

  test('switches theme from Settings and remembers it across reloads', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('can go back from New Game to the menu', async ({ page }) => {
    await openFresh(page);
    await page.getByRole('button', { name: 'New Game' }).click();
    await expect(page.getByRole('heading', { name: 'Take the oath' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Apex Sovereign' })).toBeVisible();
  });
});

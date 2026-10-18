import { expect, test } from '@playwright/test';
import { openFresh, openView, patchGame, startGame } from './support';

test.describe('Daily money, loans and the advisor (Sprint 8.8)', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await startGame(page);
  });

  test('shows the treasury’s daily change and each department’s cost per day', async ({ page }) => {
    await expect(page.getByTestId('topbar-daily')).toHaveText(/a day$/);
    await openView(page, 'Finance');
    const table = page.getByTestId('general-expenses');
    await expect(table.getByRole('row', { name: /^Defence/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^Interest on debt and loans/ })).toBeVisible();
    await expect(page.getByTestId('daily-balance')).toHaveText(/₹/);
  });

  test('takes a loan from the international lender and repays it early', async ({ page }) => {
    await openView(page, 'Finance');
    const treasury = await page.getByTestId('topbar-treasury').textContent();
    await page.getByRole('spinbutton', { name: 'Amount, ₹ crore' }).fill('20000');
    await expect(page.getByTestId('loan-terms')).toContainText('a month in interest');
    await page.getByRole('button', { name: 'Borrow ₹20,000 cr from International lender' }).click();

    const loans = page.getByRole('list', { name: 'Loans outstanding' });
    await expect(loans.getByTestId('loan')).toContainText('International lender: ₹20,000 cr');
    await expect(page.getByTestId('topbar-treasury')).not.toHaveText(treasury ?? '');
    await expect(page.getByTestId('loans-outstanding')).toHaveText('₹20,000 cr');

    await loans.getByRole('button', { name: 'Repay ₹20,000 cr to International lender' }).click();
    await expect(page.getByText('India owes nothing beyond its public debt.')).toBeVisible();
  });

  test('the advisor flags unpaid forces and opens the Military screen', async ({ page }) => {
    await expect(page.getByText(/Nothing urgent/)).toBeVisible();
    await patchGame(page, { military: { fundingRatio: 0.5 } });
    const advice = page.getByTestId('advice').first();
    await expect(advice).toContainText('The armed forces are underfunded');
    await advice.getByRole('button', { name: 'Open Military' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Military' })).toBeVisible();
  });
});

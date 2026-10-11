import { expect, test } from '@playwright/test';
import { advanceDays, openFresh, openView, patchGame, startGame } from './support';

const year = new Date().getFullYear();

test.describe('economy and governance (Phase 2)', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await startGame(page);
  });

  test('the Economy screen shows indicators, charts and the monthly accounts', async ({ page }) => {
    await advanceDays(page, 120);
    await openView(page, 'Economy');
    await expect(page.getByTestId('tile-Inflation')).toHaveText(/^\d+\.\d%$/);
    await expect(page.getByRole('figure')).toHaveCount(6);
    await expect(page.getByRole('cell', { name: 'Interest on debt' })).toBeVisible();

    await page.getByRole('button', { name: 'Why this growth?' }).hover();
    await expect(page.getByRole('tooltip')).toContainText('Trend growth');

    await page.getByRole('button', { name: '1Y' }).click();
    await expect(page.getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a budget previews its effect, is enacted, and then locks for a month', async ({ page }) => {
    await openView(page, 'Budget');
    const enact = page.getByRole('button', { name: 'Enact budget' });
    await expect(enact).toBeDisabled();

    const before = await page.getByTestId('projected-balance').textContent();
    const gst = page.getByRole('slider', { name: 'GST' });
    await gst.focus();
    await page.keyboard.press('End');
    await expect(page.getByText('23.0%')).toBeVisible();
    await expect(page.getByTestId('projected-balance')).not.toHaveText(before ?? '');
    await expect(page.getByText(/Approval: −2 now from the announcement/)).toBeVisible();

    await enact.click();
    await expect(page.getByText(/Next budget can be enacted on/)).toBeVisible();
    await expect(enact).toBeDisabled();

    await openView(page, 'Dashboard');
    await expect(page.getByText('Budget enacted')).toBeVisible();
  });

  test('a minister can be replaced from the candidate pool', async ({ page }) => {
    await openView(page, 'Cabinet');
    await expect(page.getByRole('article')).toHaveCount(11);

    await page.getByRole('button', { name: 'Choose minister for Finance' }).click();
    const dialog = page.getByRole('dialog', { name: /Appoint: Ministry of Finance/ });
    await expect(dialog).toContainText('costs -2 approval');
    const appoint = dialog.getByRole('button', { name: /^Appoint / }).first();
    const name = (await appoint.getAttribute('aria-label'))!.replace('Appoint ', '');
    await appoint.click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'Finance' })).toContainText(name);

    await page.getByRole('button', { name: `Dismiss ${name}` }).click();
    await expect(page.getByRole('article', { name: 'Finance' })).toContainText('Vacant');
  });

  test('ideology can be changed once a year', async ({ page }) => {
    await openView(page, 'Cabinet');
    await page.getByRole('combobox', { name: 'Ideology' }).selectOption({ label: 'Socialism' });
    await expect(page.getByText(/A strong state that protects workers/)).toBeVisible();
    await page.getByRole('button', { name: 'Adopt Socialism' }).click();
    await expect(page.getByRole('combobox', { name: 'Ideology' })).toHaveValue('socialism');
    await expect(page.getByText('Can change again in 365 days')).toBeVisible();
  });

  test('Reports summarises each year in office', async ({ page }) => {
    await advanceDays(page, 400);
    await openView(page, 'Reports');
    await expect(page.getByRole('row', { name: new RegExp(`^${year}\\b`) })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(`^${year + 1}\\b.*\\(1 mo\\)`) })).toBeVisible();
  });

  test('collapsing approval ends the game in impeachment', async ({ page }) => {
    await patchGame(page, {
      nation: { approval: 2 },
      economy: { inflation: 0.45, unemployment: 0.35, corruption: 100 },
    });
    await advanceDays(page, 200);
    const dialog = page.getByRole('dialog', { name: 'Impeached' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Parliament voted to impeach Asha Rao');
    await dialog.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('heading', { name: 'Apex Sovereign' })).toBeVisible();
  });
});

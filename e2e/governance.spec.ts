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
    await expect(page.getByTestId('tile-inflation')).toHaveText(/^\d+\.\d%$/);
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

  test('a department service can be upgraded to the next star', async ({ page }) => {
    await openView(page, 'Departments');
    await expect(page.getByRole('article')).toHaveCount(11);
    const health = page.getByRole('article', { name: 'Health' });
    const primaryCare = health.getByTestId('service-primaryCare');
    await expect(primaryCare.getByRole('img', { name: '2 of 5 stars' })).toBeVisible();

    await primaryCare.getByRole('button', { name: /^Upgrade Primary care to 3 stars/ }).click();
    await expect(primaryCare).toContainText(/Upgrading: \d+ days left/);
    await advanceDays(page, 31);
    await expect(primaryCare.getByRole('img', { name: '3 of 5 stars' })).toBeVisible();
  });

  test('schools are built in a region, open after a few weeks and raise its coverage', async ({ page }) => {
    await openView(page, 'Construction');
    await page.getByRole('button', { name: 'Show East' }).click();
    await expect(page.getByRole('heading', { name: 'Build in the East' })).toBeVisible();

    const schools = page.getByTestId('area-schools');
    const before = (await schools.getByRole('strong').first().textContent()) ?? '';
    const row = schools.getByTestId('facility-primarySchool');
    const count = Number(((await row.getByTestId('count-primarySchool').textContent()) ?? '').replace(/,/g, ''));
    await row.getByRole('spinbutton').fill('20000');
    await row.getByRole('button', { name: /^Build 20000 × Primary school in the East/ }).click();
    await expect(page.getByTestId('build-order')).toHaveCount(1);
    await expect(page.getByTestId('build-order')).toContainText(/Opens in \d+ days/);

    await advanceDays(page, 22);
    await expect(page.getByTestId('build-order')).toHaveCount(0);
    await expect(row.getByTestId('count-primarySchool')).toHaveText((count + 20000).toLocaleString('en-IN'));
    await expect(schools.getByRole('strong').first()).not.toHaveText(before);
    await expect(page.getByTestId('running-costs')).toContainText('Education');
  });

  test('a solar park is built, connects after a few weeks and raises production', async ({ page }) => {
    await openView(page, 'Energy');
    await page.getByRole('group', { name: 'Region' }).getByRole('button', { name: 'West' }).click();
    await expect(page.getByRole('heading', { name: 'Build in the West' })).toBeVisible();
    const before = (await page.getByTestId('power-production').textContent()) ?? '';

    const solar = page.getByTestId('plant-solar');
    await solar.getByRole('spinbutton').fill('10');
    await solar.getByRole('button', { name: /^Build 10 × Solar park in the West/ }).click();
    await expect(page.getByTestId('plant-order')).toContainText(/Connects in \d+ days/);

    await advanceDays(page, 22);
    await expect(page.getByTestId('plant-order')).toHaveCount(0);
    await expect(page.getByTestId('power-production')).not.toHaveText(before);
    await expect(page.getByTestId('plant-running-costs')).not.toContainText('₹0 cr');
    await expect(page.getByTestId('grid-effects')).toContainText('Power exported');
  });

  test('a private plant is licensed for a fee and opens after a short build', async ({ page }) => {
    await openView(page, 'Industry');
    await expect(page.getByTestId('goods-table')).toContainText('Crude oil');
    await page.getByRole('group', { name: 'Region' }).getByRole('button', { name: 'South' }).click();
    const pharma = page.getByTestId('industry-pharmaPlant');
    const before = (await pharma.getByTestId('plants-pharmaPlant').textContent()) ?? '';
    await pharma.getByRole('button', { name: /^License a private pharmaceutical plant in the South/ }).click();
    await expect(page.getByTestId('industry-order')).toContainText('private');

    await advanceDays(page, 46);
    await expect(page.getByTestId('industry-order')).toHaveCount(0);
    await expect(pharma.getByTestId('plants-pharmaPlant')).not.toHaveText(before);
  });

  test('a state steel mill is built from the treasury and starts producing when it opens', async ({ page }) => {
    await openView(page, 'Industry');
    await page.getByRole('group', { name: 'Region' }).getByRole('button', { name: 'East', exact: true }).click();
    const mill = page.getByTestId('industry-steelMill');
    const before = (await mill.getByTestId('plants-steelMill').textContent()) ?? '';
    const treasury = await page.getByTestId('topbar-treasury').textContent();
    await mill.getByRole('button', { name: /^Build 1 state Steel mill in the East for/ }).click();
    await expect(page.getByTestId('industry-order')).toContainText('Steel mill');
    await expect(page.getByTestId('topbar-treasury')).not.toHaveText(treasury ?? '');

    await advanceDays(page, 181);
    await expect(page.getByTestId('industry-order')).toHaveCount(0);
    await expect(mill.getByTestId('plants-steelMill')).not.toHaveText(before);
  });

  test('goods bought into stock become surplus, and “Sell all surplus” sells them abroad', async ({ page }) => {
    await openView(page, 'Trade Market');
    const sellAll = page.getByRole('button', { name: /^Sell all surplus|^No surplus to sell/ });
    await expect(sellAll).toHaveText('No surplus to sell');
    const medicines = page.getByTestId('good-medicines');
    await medicines.getByRole('spinbutton', { name: 'How many kt of medicines to trade' }).fill('50');
    await medicines.getByRole('button', { name: /^Buy 50 kt of medicines from/ }).click();
    await expect(medicines).toContainText('surplus 50');

    await expect(sellAll).toHaveText(/^Sell all surplus · about ₹/);
    await sellAll.click();
    await expect(sellAll).toHaveText('No surplus to sell');
  });

  test('the Trade Market sets a tariff and signs a supply contract', async ({ page }) => {
    await openView(page, 'Trade Market');
    const crude = page.getByTestId('good-crudeOil');
    await expect(crude).toContainText(/Best seller: .+ at ₹/);
    await crude.getByText(/^Trade rules/).click();
    await crude.getByRole('spinbutton').first().fill('20');
    await crude.getByRole('button', { name: 'Apply the trade rules for crude oil' }).click();
    await expect(crude).toContainText('Now: tariff 20%');

    await page.getByRole('combobox', { name: 'Good' }).selectOption({ label: 'Steel' });
    await page.getByRole('combobox', { name: 'Partner' }).selectOption({ label: 'Japan' });
    // A new game has no spare steel, so a sale contract cannot be signed; a purchase can.
    await expect(page.getByTestId('contract-spare')).toContainText('Spare steel for new sale contracts: 0 Mt');
    await expect(page.getByRole('button', { name: /^Sign at ₹/ })).toBeDisabled();
    await page.getByRole('combobox', { name: 'Deal' }).selectOption({ label: 'India buys' });
    await page.getByRole('button', { name: /^Sign at ₹/ }).click();
    const contracts = page.getByTestId('supply-contracts');
    await expect(contracts).toContainText('India buys 1 Mt of steel a month');
    await expect(contracts).toContainText('Not yet');
  });

  test('ideology can be changed once a year', async ({ page }) => {
    await openView(page, 'Departments');
    await page.getByRole('combobox', { name: 'Ideology' }).selectOption({ label: 'Socialism' });
    await expect(page.getByText(/A strong state that protects workers/)).toBeVisible();
    await page.getByRole('button', { name: 'Adopt Socialism' }).click();
    await expect(page.getByRole('combobox', { name: 'Ideology' })).toHaveValue('socialism');
    await expect(page.getByText('Can change again in 365 days')).toBeVisible();
  });

  test('Reports summarises each year in office', async ({ page }) => {
    // Start popular so a hands-off President is not impeached by the crises of the first 13 months.
    await patchGame(page, { nation: { approval: 95 } });
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

test.describe('national play (Sprint 8.10)', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await startGame(page, 'Asha Rao', 'Normal', { regions: false });
  });

  test('clinics are ordered for all of India and open where they are needed', async ({ page }) => {
    await openView(page, 'Construction');
    await expect(page.getByRole('heading', { name: 'Build in India' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show East' })).toHaveCount(0);

    const row = page.getByTestId('area-clinics').getByTestId('facility-clinic');
    const count = Number(((await row.getByTestId('count-clinic').textContent()) ?? '').replace(/,/g, ''));
    await row.getByRole('spinbutton').fill('500');
    await row.getByRole('button', { name: /^Build 500 × Health clinic in India/ }).click();
    await expect(page.getByTestId('build-order')).toContainText('India');

    await advanceDays(page, 31);
    await expect(page.getByTestId('build-order')).toHaveCount(0);
    await expect(row.getByTestId('count-clinic')).toHaveText((count + 500).toLocaleString('en-IN'));
  });

  test('the police and security screens show India, not regions', async ({ page }) => {
    await openView(page, 'Police');
    await expect(page.getByRole('heading', { name: 'Police across India' })).toBeVisible();
    await expect(page.getByTestId('police-india')).toBeVisible();
    await expect(page.getByTestId('police-east')).toHaveCount(0);

    await openView(page, 'Security');
    await expect(page.getByTestId('national-unrest')).toBeVisible();
    await expect(page.getByRole('img', { name: /map/i })).toHaveCount(0);
  });
});

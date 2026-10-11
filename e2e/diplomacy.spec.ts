import { expect, test, type Page } from '@playwright/test';
import { advanceDays, openFresh, openView, patchGame, raiseEvent, startGame } from './support';

/** Keeps a long fast-forward from ending the term early (the demo is about the world, not about politics). */
const steady = (page: Page) => patchGame(page, { nation: { approval: 90 }, security: { militaryLoyalty: 100 } });

type CountryRecord = Record<string, unknown>;

/** Sets a country's relation with India through the debug hook, so a proposal is very likely to be accepted. */
async function warm(page: Page, id: string, relation = 95): Promise<void> {
  await page.evaluate(
    ([country, value]) => {
      const { game } = window.__APEX__.getState() as unknown as {
        game: { diplomacy: { countries: Record<string, CountryRecord> } };
      };
      const countries = game.diplomacy.countries;
      window.__APEX__.patchGame({
        diplomacy: {
          countries: {
            ...countries,
            [country as string]: { ...countries[country as string], relation: value, proposalReadyTick: 0 },
          },
        },
      });
    },
    [id, relation] as const,
  );
}

const findCountry = async (page: Page, name: string) => {
  await page.getByLabel('Find a country').fill(name);
  await page
    .getByRole('list', { name: 'Matching countries' })
    .getByRole('button', { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
};

test.describe('World stage (Phase 5, milestone M5)', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await openView(page, 'World');
  });

  test('shows the interactive map: overlays, zoom, hover and select', async ({ page }) => {
    const map = page.getByTestId('world-map');
    await expect(map).toBeVisible();
    await expect(map.locator('path[data-id]')).toHaveCount(206);
    await expect(page.getByText(/Boundaries follow the Survey of India/)).toBeVisible();

    for (const overlay of ['Power', 'Trade', 'War', 'Relation']) {
      await page.getByRole('group', { name: 'Map overlay' }).getByRole('button', { name: overlay }).click();
      await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
    }

    // Hover shows the country and the overlay's value.
    await map.locator('path[data-id="JPN"]').hover({ force: true });
    await expect(page.getByRole('status').filter({ hasText: 'Japan' })).toContainText('Relation');

    // Zoom in and back out.
    const layer = page.getByTestId('map-layer');
    await expect(layer).toHaveAttribute('data-zoom', '1.00');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(layer).not.toHaveAttribute('data-zoom', '1.00');
    await page.getByRole('button', { name: 'Reset the map view' }).click();
    await expect(layer).toHaveAttribute('data-zoom', '1.00');

    // Drag pans a zoomed map; a plain click selects.
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const before = await layer.getAttribute('transform');
    const box = await map.boundingBox();
    if (!box) throw new Error('map has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 4 });
    await page.mouse.up();
    await expect(layer).not.toHaveAttribute('transform', before ?? '');
    await page.getByRole('button', { name: 'Reset the map view' }).click();

    await map.locator('path[data-id="DEU"]').click({ force: true });
    await expect(page.getByTestId('country-panel')).toHaveAttribute('data-country', 'DEU');
  });

  test('opens a country panel with stats, a Why? breakdown and the actions', async ({ page }) => {
    await findCountry(page, 'Japan');
    const panel = page.getByTestId('country-panel');
    await expect(panel).toContainText('Economy');
    await expect(panel).toContainText('Outlook');
    await expect(page.getByTestId('country-relation')).toHaveText(/-?\d+/);
    await panel.getByRole('button', { name: 'Why?' }).first().hover();
    await expect(page.getByRole('tooltip').first()).toContainText('Starting attitude');
    await expect(panel.getByRole('button', { name: /Propose contract/ })).toBeEnabled();
    await expect(panel.getByRole('button', { name: /Open embassy/ })).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Impose sanctions' })).toBeEnabled();
  });

  test('demo: signs a trade contract, a pact with a neighbour, and survives a regional crisis', async ({ page }) => {
    // 1. A trade contract with a focus nation. Acceptance is a roll, so keep asking (with a decent odds boost).
    await findCountry(page, 'Japan');
    const panel = page.getByTestId('country-panel');
    await page.getByLabel('Contract sector').selectOption('tech');
    const trade = page.getByTestId('trade-count');
    for (let i = 0; i < 6; i++) {
      await warm(page, 'JPN');
      await panel.getByRole('button', { name: /Propose contract/ }).click();
      const outcome = await page.getByTestId('country-result').textContent();
      if (outcome?.includes('signed')) break;
      await advanceDays(page, 1);
    }
    await expect(panel.getByRole('list', { name: 'Treaties with this country' })).toContainText('Trade: Technology');

    // 2. A non-aggression pact with a neighbour.
    await findCountry(page, 'Nepal');
    for (let i = 0; i < 8; i++) {
      await warm(page, 'NPL');
      await panel.getByRole('button', { name: /Propose non-aggression pact/ }).click();
      const outcome = await page.getByTestId('country-result').textContent();
      if (outcome?.includes('Non-aggression pact with Nepal')) break;
    }
    await expect(panel.getByRole('list', { name: 'Treaties with this country' })).toContainText('Non-aggression pact');

    // 3. A regional crisis arrives and is handled; the map shows it.
    await raiseEvent(page, 'regional-conflict', undefined, 'TUR');
    const banner = page.getByRole('region', { name: 'Pending decisions' });
    await banner.getByRole('button', { name: 'Review' }).click();
    const dialog = page.getByRole('dialog', { name: /Fighting breaks out near Tur/ });
    await dialog.getByRole('button', { name: 'Choose: Offer to mediate' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await steady(page);
    await advanceDays(page, 120);
    await openView(page, 'Diplomacy');
    await expect(page.getByRole('list', { name: 'Crises' })).toBeVisible();
    await expect(page.getByTestId('trade-count')).toHaveText('1/6');
    await expect(page.getByRole('table', { name: 'Active treaties' })).toContainText('Japan');
    await expect(page.getByRole('table', { name: 'Active treaties' })).toContainText('Nepal');
    await expect(trade).toBeVisible();
  });

  test('the Diplomacy screen answers offers and lets a treaty be ended with a confirmation', async ({ page }) => {
    await warm(page, 'DEU');
    await page.evaluate(() => {
      const { game } = window.__APEX__.getState() as unknown as { game: { clock: { tick: number } } };
      window.__APEX__.patchGame({
        diplomacy: {
          offers: [
            {
              id: 'ofr-test',
              from: 'DEU',
              type: 'trade',
              years: 3,
              terms: { sector: 'industry', value: 50_000 },
              raisedTick: game.clock.tick,
              expiresTick: game.clock.tick + 90,
            },
          ],
        },
      });
    });
    await expect(page.getByRole('region', { name: 'Diplomatic offers' })).toContainText('1 diplomatic offer');
    await page.getByRole('region', { name: 'Diplomatic offers' }).getByRole('button', { name: 'Diplomacy' }).click();
    const offers = page.getByRole('list', { name: 'Offers' });
    await expect(offers).toContainText('Germany proposes a 3-year industry contract');
    await offers.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByTestId('trade-count')).toHaveText('1/6');

    const rep = Number((await page.getByTestId('reputation').textContent())?.split('/')[0]);
    await page.getByRole('button', { name: 'End Trade contract with Germany' }).click();
    await page.getByRole('button', { name: /Confirm: costs reputation/ }).click();
    await expect(page.getByTestId('trade-count')).toHaveText('0/6');
    await expect(page.getByTestId('reputation')).not.toHaveText(`${rep}/100`);
  });

  test('sanctions need a confirmation, end trade and can be lifted', async ({ page }) => {
    await findCountry(page, 'Russia');
    const panel = page.getByTestId('country-panel');
    await panel.getByRole('button', { name: 'Impose sanctions' }).click();
    await panel.getByRole('button', { name: /Confirm sanctions on Russia/ }).click();
    await expect(panel.getByRole('list', { name: 'Treaties with this country' })).toContainText('India’s sanctions');
    await expect(panel.getByRole('button', { name: /Propose contract/ })).toBeDisabled();
    await panel.getByRole('button', { name: 'Lift sanctions' }).click();
    await expect(panel.getByRole('list', { name: 'Treaties with this country' })).toHaveCount(0);
  });

  test('the AI debug overlay explains each nation’s choice (development builds)', async ({ page }) => {
    await steady(page);
    await advanceDays(page, 40);
    await openView(page, 'Diplomacy');
    await page.getByRole('button', { name: 'Show AI debug' }).click();
    const debug = page.getByTestId('ai-debug');
    await expect(debug).toContainText('China');
    await expect(debug).toContainText(/Offer a deal: /);
    await expect(debug.getByTestId('ai-PAK')).toContainText(/relation .*deterrence/);
  });
});

test.describe('Phase 5 screenshots', () => {
  test.skip(!process.env['SCREENSHOTS'], 'Set SCREENSHOTS=1 to refresh docs/screenshots/phase-5.');

  test('captures the World and Diplomacy screens', async ({ page }) => {
    await openFresh(page);
    await startGame(page);
    await steady(page);
    await warm(page, 'JPN');
    await advanceDays(page, 90);
    await openView(page, 'World');
    await findCountry(page, 'Japan');
    await page.screenshot({ path: 'docs/screenshots/phase-5/world-relation.png' });
    await page.getByRole('group', { name: 'Map overlay' }).getByRole('button', { name: 'Power' }).click();
    await page.screenshot({ path: 'docs/screenshots/phase-5/world-power.png' });
    await page.getByRole('group', { name: 'Map overlay' }).getByRole('button', { name: 'Relation' }).click();
    const india = await page.locator('path[data-id="IND"]').boundingBox();
    if (!india) throw new Error('India has no box');
    await page.mouse.move(india.x + india.width / 2, india.y + india.height / 2);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
    await page.screenshot({ path: 'docs/screenshots/phase-5/world-zoom-india.png' });
    await openView(page, 'Diplomacy');
    await page.screenshot({ path: 'docs/screenshots/phase-5/diplomacy.png', fullPage: true });
  });
});

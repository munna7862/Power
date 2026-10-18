import { openingEnergy } from '../energy/grid';
import { openingIndustry, openingMarket } from '../industry/flows';
import { openingInfrastructure } from '../infrastructure/coverage';
import { START_CRIME } from '../police/constants';
import { openingPolice } from '../police/strength';
import { SCHEMA_VERSION } from '../state/types';

/** Upgrades a raw state from version N to N + 1. */
export type Migration = (state: unknown) => unknown;

/**
 * The first save version of the current edition. Phase 8 rebuilt the game around departments, construction and
 * industry; saves from the previous edition (v1–v6) cannot be carried over and are refused with an explanation.
 * Old saves must keep loading from this version on.
 */
export const FIRST_EDITION_VERSION = 7;

export const PREVIOUS_EDITION_MESSAGE =
  'This save comes from the previous edition of the game, which ran the country through a cabinet of ministers. It cannot be continued; start a new game.';

/**
 * Registry keyed by the version being migrated FROM.
 * When SCHEMA_VERSION goes up, add a step here and a golden fixture for the old version.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v7 → v8 (Sprint 8.2): public works arrive. A game in progress gets the opening network every game starts with.
  7: (state) => ({ ...(state as object), schemaVersion: 8, infrastructure: openingInfrastructure() }),
  // v8 → v9 (Sprint 8.3): the police and agencies are run directly, and crime is tracked by region. A game in
  // progress gets the opening force and starting crime.
  8: (state) => {
    const v8 = state as { security: object };
    return {
      ...v8,
      schemaVersion: 9,
      security: { ...v8.security, crime: { ...START_CRIME } },
      police: openingPolice(),
    };
  },
  // v9 → v10 (Sprint 8.4): the power grid. A game in progress gets the opening fleet of power plants.
  9: (state) => ({ ...(state as object), schemaVersion: 10, energy: openingEnergy() }),
  // v10 → v11 (Sprints 8.5 and 8.6): industry, goods and the trade market. A game in progress gets the opening
  // plants, stocks at target, the opening settlement and world prices at base.
  10: (state) => ({ ...(state as object), schemaVersion: 11, industry: openingIndustry(), market: openingMarket() }),
  // v11 → v12 (Sprints 8.7 and 8.8): equipment is bought from the treasury, so the Defence procurement fund is paid
  // into it; and loans arrive, of which a game in progress has none.
  11: (state) => {
    const v11 = state as {
      nation: { treasury: number };
      economy: object;
      military: { procurementFund?: number } & Record<string, unknown>;
    };
    const { procurementFund = 0, ...military } = v11.military;
    return {
      ...v11,
      schemaVersion: 12,
      nation: { ...v11.nation, treasury: Math.round(v11.nation.treasury + procurementFund) },
      economy: { ...v11.economy, loans: [] },
      military,
    };
  },
  // v12 → v13 (Sprint 8.10): the Regional play option. A game in progress was played region by region, so it keeps that.
  12: (state) => {
    const v12 = state as { meta: { options: object } };
    return {
      ...v12,
      schemaVersion: 13,
      meta: { ...v12.meta, options: { ...v12.meta.options, regions: true } },
    };
  },
  // v13 → v14: one-off receipts (licence fees, trade sales, refunds, windfalls, reparations) get their own line in
  // the monthly figures. A game in progress has none recorded yet, this month or last.
  13: (state) => {
    const v13 = state as { economy: { lastMonth: object | null } };
    const none = { licenceFees: 0, tradeSales: 0, refunds: 0, events: 0, reparations: 0 };
    return {
      ...v13,
      schemaVersion: 14,
      economy: {
        ...v13.economy,
        lastMonth: v13.economy.lastMonth && { ...v13.economy.lastMonth, receipts: { ...none } },
        receipts: { ...none },
      },
    };
  },
  // v14 → v15: state plants can be sold to investors, a new source of one-off receipts. None sold yet.
  14: (state) => {
    const v14 = state as {
      economy: { receipts: Record<string, number>; lastMonth: { receipts: Record<string, number> } | null };
    };
    const { lastMonth } = v14.economy;
    return {
      ...v14,
      schemaVersion: 15,
      economy: {
        ...v14.economy,
        lastMonth: lastMonth && { ...lastMonth, receipts: { ...lastMonth.receipts, plantSales: 0 } },
        receipts: { ...v14.economy.receipts, plantSales: 0 },
      },
    };
  },
  // v15 → v16: each supply contract's last delivery is recorded. A game in progress has none recorded yet; the
  // next monthly delivery fills them in.
  15: (state) => {
    const v15 = state as { market: object };
    return { ...v15, schemaVersion: 16, market: { ...v15.market, deliveries: {} } };
  },
  // v16 → v17: the Calm months option. A game in progress was started without it.
  16: (state) => {
    const v16 = state as { meta: { options: object } };
    return { ...v16, schemaVersion: 17, meta: { ...v16.meta, options: { ...v16.meta.options, calmMonths: false } } };
  },
};

export function migrate(
  state: unknown,
  fromVersion: number,
  toVersion: number = SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): unknown {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) throw new Error(`Invalid save version ${fromVersion}.`);
  if (fromVersion < FIRST_EDITION_VERSION && toVersion >= FIRST_EDITION_VERSION)
    throw new Error(PREVIOUS_EDITION_MESSAGE);
  if (fromVersion > toVersion) {
    throw new Error(`Save is from a newer version of the game (v${fromVersion}); please update the game.`);
  }
  let current = state;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`No migration registered from save version ${v} to ${v + 1}.`);
    current = step(current);
  }
  return current;
}

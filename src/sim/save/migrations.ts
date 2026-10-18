import { openingInfrastructure } from '../infrastructure/coverage';
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

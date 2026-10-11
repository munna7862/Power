import { SCHEMA_VERSION } from '../state/types';

/** Upgrades a raw state from version N to N + 1. */
export type Migration = (state: unknown) => unknown;

/**
 * Registry keyed by the version being migrated FROM.
 * When SCHEMA_VERSION goes from 1 to 2, add `1: (s) => ...` here and a golden v2 fixture.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function migrate(
  state: unknown,
  fromVersion: number,
  toVersion: number = SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): unknown {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) throw new Error(`Invalid save version ${fromVersion}.`);
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

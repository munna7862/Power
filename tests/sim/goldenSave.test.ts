import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { advanceDays, parseSave, SCHEMA_VERSION, serializeSave } from '../../src/sim';
import { newGame } from '../helpers';

/**
 * Golden save fixtures: one per schema version, committed and never edited.
 * Every future version of the game must still load them (via migrations).
 * Regenerate the current version's fixture only when creating it:
 *   UPDATE_GOLDEN=1 npx vitest run tests/sim/goldenSave.test.ts
 */
const fixture = (version: number) => fileURLToPath(new URL(`../fixtures/saves/v${version}.json`, import.meta.url));

describe('golden save fixtures', () => {
  if (process.env.UPDATE_GOLDEN) {
    it(`writes the v${SCHEMA_VERSION} fixture`, () => {
      const state = advanceDays(newGame({ seed: 2026, presidentName: 'Golden Fixture' }), 400);
      writeFileSync(
        fixture(SCHEMA_VERSION),
        `${JSON.stringify(JSON.parse(serializeSave(state, '2026-10-11T00:00:00.000Z')), null, 2)}\n`,
      );
    });
  }

  it.each(Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1))('loads the v%i fixture', (version) => {
    const result = parseSave(readFileSync(fixture(version), 'utf8'));
    if (!result.ok) throw new Error(result.error);
    expect(result.save.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.save.summary.presidentName).toBe('Golden Fixture');
  });

  it('upgrades a v1 (Phase 1) save: keeps the date, treasury, approval and inbox, and adds the new systems', () => {
    const raw = JSON.parse(readFileSync(fixture(1), 'utf8'));
    const result = parseSave(JSON.stringify(raw));
    if (!result.ok) throw new Error(result.error);
    const { state } = result.save;
    expect(state.clock).toEqual(raw.state.clock);
    expect(state.nation).toMatchObject({ treasury: raw.state.nation.treasury, approval: raw.state.nation.approval });
    expect(state.history).toHaveLength(raw.state.history.length);
    expect(state.log.slice(0, raw.state.log.length)).toEqual(raw.state.log);
    expect(state.log.at(-1)?.title).toBe('Save upgraded');
    expect(state.cabinet.ministers.finance).not.toBeNull();
    expect(state.modifiers.every((m) => m.target !== ('economy.monthlyRevenue' as never))).toBe(true);
    expect(advanceDays(state, 365).status.kind).toBe('playing');
  });
});

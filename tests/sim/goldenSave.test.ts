import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { advanceDays, dispatch, parseSave, SCHEMA_VERSION, serializeSave } from '../../src/sim';
import { FIRST_EDITION_VERSION, PREVIOUS_EDITION_MESSAGE } from '../../src/sim/save/migrations';
import { newGame } from '../helpers';

/**
 * Golden save fixtures: one per schema version, committed and never edited.
 * From v7 (the current edition) on, every future version of the game must still load them (via migrations).
 * v1–v6 come from the previous edition, which ran the country through a cabinet; they are kept to prove those
 * saves are refused with a clear explanation rather than crashing or loading half a game.
 * Regenerate the current version's fixture only when creating it:
 *   UPDATE_GOLDEN=1 npx vitest run tests/sim/goldenSave.test.ts
 */
const fixture = (version: number) => fileURLToPath(new URL(`../fixtures/saves/v${version}.json`, import.meta.url));

describe('golden save fixtures', () => {
  if (process.env.UPDATE_GOLDEN) {
    it(`writes the v${SCHEMA_VERSION} fixture`, () => {
      // An embassy, a service upgrade, some schools, more police and a solar park so the fixture carries them all,
      // an option switched on, then a year of play.
      let state = newGame({ seed: 2026, presidentName: 'Golden Fixture', options: { noRiots: true } });
      for (const command of [
        { type: 'OPEN_EMBASSY', country: 'USA' },
        { type: 'UPGRADE_SERVICE', department: 'health', service: 'primaryCare' },
        { type: 'BUILD_FACILITY', facility: 'primarySchool', region: 'east', quantity: 500 },
        { type: 'RECRUIT_POLICE', region: 'north', officers: 5000 },
        { type: 'FUND_AGENCY', agency: 'intelligenceService', strength: 55 },
        { type: 'BUILD_PLANT', plant: 'solar', region: 'west', quantity: 4 },
      ] as const) {
        const result = dispatch(state, command);
        if (!result.ok) throw new Error(result.error);
        state = result.state;
      }
      state = advanceDays(state, 400);
      writeFileSync(
        fixture(SCHEMA_VERSION),
        `${JSON.stringify(JSON.parse(serializeSave(state, '2026-10-18T00:00:00.000Z')), null, 2)}\n`,
      );
    });
  }

  const current = Array.from(
    { length: SCHEMA_VERSION - FIRST_EDITION_VERSION + 1 },
    (_, i) => i + FIRST_EDITION_VERSION,
  );
  it.each(current)('loads the v%i fixture', (version) => {
    const result = parseSave(readFileSync(fixture(version), 'utf8'));
    if (!result.ok) throw new Error(result.error);
    expect(result.save.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.save.summary.presidentName).toBe('Golden Fixture');
    expect(result.save.state.departments.stars.health.primaryCare).toBe(3);
    expect(advanceDays(result.save.state, 60).status.kind).toBe('playing');
  });

  const previous = Array.from({ length: FIRST_EDITION_VERSION - 1 }, (_, i) => i + 1);
  it.each(previous)('refuses the previous edition’s v%i fixture with an explanation', (version) => {
    const result = parseSave(readFileSync(fixture(version), 'utf8'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(PREVIOUS_EDITION_MESSAGE);
  });
});

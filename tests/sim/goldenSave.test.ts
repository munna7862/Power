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
});

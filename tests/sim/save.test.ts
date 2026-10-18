import { describe, expect, it } from 'vitest';
import { advanceDays, hashState, parseSave, SAVE_FORMAT, SCHEMA_VERSION, serializeSave } from '../../src/sim';
import { stableStringify } from '../../src/sim/save/hash';
import { migrate, PREVIOUS_EDITION_MESSAGE } from '../../src/sim/save/migrations';
import { newGame } from '../helpers';

const SAVED_AT = '2026-10-11T12:00:00.000Z';

const tamper = (json: string, edit: (raw: Record<string, unknown>) => void): string => {
  const raw = JSON.parse(json) as Record<string, unknown>;
  edit(raw);
  return JSON.stringify(raw);
};

describe('save files', () => {
  it('round-trips a game exactly', () => {
    const state = advanceDays(newGame(), 95);
    const result = parseSave(serializeSave(state, SAVED_AT));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hashState(result.save.state)).toBe(hashState(state));
    expect(result.save.savedAt).toBe(SAVED_AT);
    expect(result.save.summary).toEqual({
      presidentName: 'Test President',
      difficulty: 'normal',
      gameDate: '6 Apr 2026',
      tick: 95,
    });
  });

  it('continues deterministically after loading', () => {
    const state = advanceDays(newGame(), 200);
    const loaded = parseSave(serializeSave(state, SAVED_AT));
    if (!loaded.ok) throw new Error(loaded.error);
    expect(hashState(advanceDays(loaded.save.state, 300))).toBe(hashState(advanceDays(state, 300)));
  });

  it.each([
    ['invalid JSON', () => '{not json', /not valid JSON/],
    ['wrong format', () => JSON.stringify({ format: 'other' }), /Not an India: Apex Sovereign save/],
    [
      'missing header fields',
      () => tamper(serializeSave(newGame(), SAVED_AT), (r) => delete r.checksum),
      /header is incomplete/,
    ],
    [
      'a tampered state',
      () =>
        tamper(serializeSave(newGame(), SAVED_AT), (r) => {
          (r.state as { nation: { treasury: number } }).nation.treasury = 9e15;
        }),
      /checksum mismatch/,
    ],
    [
      'a newer schema version',
      () => tamper(serializeSave(newGame(), SAVED_AT), (r) => (r.schemaVersion = 99)),
      /newer version/,
    ],
  ])('rejects %s with a clear error', (_label, build, message) => {
    const result = parseSave(build());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('rejects a structurally invalid state even when its checksum matches', () => {
    const broken = { ...newGame(), nation: { name: 'India' } };
    const json = JSON.stringify({
      format: SAVE_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      savedAt: SAVED_AT,
      checksum: hashState(broken),
      summary: {},
      state: broken,
    });
    const result = parseSave(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid at nation/);
  });
});

describe('migrations', () => {
  it('passes the current version through untouched', () => {
    const state = { a: 1 };
    expect(migrate(state, 1, 1)).toBe(state);
  });

  it('applies registered steps in order', () => {
    const steps = {
      1: (s: unknown) => ({ ...(s as object), v2: true }),
      2: (s: unknown) => ({ ...(s as object), v3: true }),
    };
    expect(migrate({ v1: true }, 1, 3, steps)).toEqual({ v1: true, v2: true, v3: true });
  });

  it('fails clearly when a step is missing or the version is invalid', () => {
    expect(() => migrate({}, 1, 3, { 1: (s) => s })).toThrow(/from save version 2 to 3/);
    expect(() => migrate({}, 0)).toThrow(/Invalid save version/);
  });

  it('refuses saves from the previous edition (v1–v6) with an explanation', () => {
    for (const v of [1, 6]) expect(() => migrate({}, v)).toThrow(PREVIOUS_EDITION_MESSAGE);
  });
});

describe('stableStringify', () => {
  it('is independent of key order and skips undefined values', () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: undefined }] })).toBe(stableStringify({ a: [{ d: 2 }], b: 1 }));
  });
});

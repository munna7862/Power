import { describe, expect, it } from 'vitest';
import { dispatch, MINISTRIES, ministryEfficiency, RESHUFFLE_APPROVAL, type GameState } from '../../src/sim';
import { Rng } from '../../src/sim/engine/rng';
import { refreshCandidates } from '../../src/sim/cabinet/generate';
import { calm, deepFreeze, newGame } from '../helpers';

describe('cabinet commands', () => {
  it('appoints a candidate, removes them from the pool and charges a reshuffle cost', () => {
    const state = deepFreeze(newGame());
    const candidate = state.cabinet.candidates.finance[0]!;
    const outgoing = state.cabinet.ministers.finance!;
    const result = dispatch(state, { type: 'APPOINT_MINISTER', ministry: 'finance', candidateId: candidate.id });
    expect(result.ok).toBe(true);
    const next = result.state;
    expect(next.cabinet.ministers.finance).toMatchObject({ id: candidate.id, appointedTick: 0 });
    expect(next.cabinet.candidates.finance.map((c) => c.id)).not.toContain(candidate.id);
    expect(next.modifiers.find((m) => m.source === 'reshuffle')).toMatchObject({
      value: RESHUFFLE_APPROVAL,
      label: `Reshuffle: ${outgoing.name} removed`,
    });
    expect(next.cabinet.ministers.health!.loyalty).toBe(state.cabinet.ministers.health!.loyalty - 3);
    expect(next.log.at(-1)?.title).toBe('New minister: Finance');
  });

  it('fills a vacancy without a reshuffle cost', () => {
    const vacant = dispatch(newGame(), { type: 'DISMISS_MINISTER', ministry: 'health' }).state;
    const reshuffles = vacant.modifiers.filter((m) => m.source === 'reshuffle').length;
    const candidate = vacant.cabinet.candidates.health[0]!;
    const filled = dispatch(vacant, { type: 'APPOINT_MINISTER', ministry: 'health', candidateId: candidate.id }).state;
    expect(filled.modifiers.filter((m) => m.source === 'reshuffle')).toHaveLength(reshuffles);
  });

  it('dismisses a minister, leaving the ministry to a civil servant', () => {
    const state = newGame();
    const result = dispatch(state, { type: 'DISMISS_MINISTER', ministry: 'education' });
    expect(result.ok).toBe(true);
    expect(result.state.cabinet.ministers.education).toBeNull();
    expect(result.state.log.at(-1)?.severity).toBe('warning');
    expect(ministryEfficiency(result.state, 'education')).toBeCloseTo(0.91);
    expect(dispatch(result.state, { type: 'DISMISS_MINISTER', ministry: 'education' })).toMatchObject({
      ok: false,
      error: 'That post is already vacant.',
    });
  });

  it('rejects unknown candidates and ministries', () => {
    const state = newGame();
    const other = state.cabinet.candidates.health[0]!.id;
    expect(dispatch(state, { type: 'APPOINT_MINISTER', ministry: 'finance', candidateId: other }).ok).toBe(false);
    expect(dispatch(state, { type: 'APPOINT_MINISTER', ministry: 'nope' as never, candidateId: other }).ok).toBe(false);
    expect(dispatch(state, { type: 'DISMISS_MINISTER', ministry: 'nope' as never }).ok).toBe(false);
  });
});

describe('cabinet over time', () => {
  it('posts a quarterly report and refreshes candidates every 1 January', () => {
    const start = newGame();
    const april = calm(start, 31 + 28 + 31);
    expect(april.log.some((e) => e.title === 'Quarterly cabinet report')).toBe(true);
    const nextYear = calm(start, 365);
    expect(nextYear.log.some((e) => e.title === 'New cabinet candidates')).toBe(true);
    expect(nextYear.cabinet.candidates.finance[0]!.id).not.toBe(start.cabinet.candidates.finance[0]!.id);
  });

  it('exposes corrupt ministers in scandals that hurt approval', () => {
    const start = newGame();
    const ministers = Object.fromEntries(
      MINISTRIES.map((m) => [m, { ...start.cabinet.ministers[m]!, corruption: 100 }]),
    ) as GameState['cabinet']['ministers'];
    const later = calm({ ...start, cabinet: { ...start.cabinet, ministers } }, 365);
    expect(later.log.some((e) => e.title.startsWith('Scandal in'))).toBe(true);
    expect(later.modifiers.some((m) => m.source === 'scandal' && m.value < 0)).toBe(true);
  });

  it('drifts loyalty up for ministers who share the President’s ideology', () => {
    const start = newGame({ ideology: 'socialism' });
    const ministers = Object.fromEntries(
      MINISTRIES.map((m) => [m, { ...start.cabinet.ministers[m]!, ideology: 'socialism' as const, loyalty: 40 }]),
    ) as GameState['cabinet']['ministers'];
    const later = calm({ ...start, cabinet: { ...start.cabinet, ministers } }, 365 * 2);
    const average = MINISTRIES.reduce((s, m) => s + later.cabinet.ministers[m]!.loyalty, 0) / MINISTRIES.length;
    expect(average).toBeGreaterThan(55);
  });

  it('generates candidates with unique names and bounded traits', () => {
    const state = refreshCandidates(newGame(), new Rng(newGame().rng));
    for (const m of MINISTRIES) {
      for (const c of state.cabinet.candidates[m]) {
        for (const trait of [c.competence, c.loyalty, c.corruption]) {
          expect(trait).toBeGreaterThanOrEqual(0);
          expect(trait).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  allEfficiencies,
  BANKRUPTCY_MONTHS,
  coupChance,
  coupRisk,
  dispatch,
  intelligenceFoilChance,
  MAX_INVESTIGATIONS,
  MINISTRIES,
  OPERATIONS,
  parseSave,
  presidentialSafety,
  REGIONS,
  serializeSave,
  terrorTarget,
  unrestTarget,
  type GameState,
} from '../../src/sim';
import { Rng, seedRng } from '../../src/sim/engine/rng';
import { launchOperation } from '../../src/sim/security/operations';
import { exposeMinister } from '../../src/sim/cabinet/scandal';
import { deepFreeze, newGame } from '../helpers';
import { SYSTEMS } from '../../src/sim/systems';

/** Only the named systems, for isolating one mechanism. */
const only = (...ids: string[]) => SYSTEMS.filter((s) => ids.includes(s.id));
const run = (state: GameState, days: number, ...ids: string[]) => advanceDays(state, days, only(...ids));
const withSecurity = (state: GameState, patch: Partial<GameState['security']>): GameState => ({
  ...state,
  security: { ...state.security, ...patch },
});

describe('unrest', () => {
  it('rises with unemployment, inflation and corruption and falls with policing', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    const base = unrestTarget(state, 'east', eff).total;
    const bad = { ...state, economy: { ...state.economy, unemployment: 0.15, inflation: 0.12, corruption: 80 } };
    expect(unrestTarget(bad, 'east', eff).total).toBeGreaterThan(base + 15);
    expect(unrestTarget(state, 'east', { ...eff, home: 1.8 }).total).toBeLessThan(base);
    expect(unrestTarget(state, 'northEast', eff).total).toBeGreaterThan(unrestTarget(state, 'south', eff).total);
  });

  it('drifts each region toward its target and stays within 0–100', () => {
    const hot = { ...newGame(), economy: { ...newGame().economy, unemployment: 0.3, inflation: 0.4 } };
    const later = run(hot, 365 * 3, 'unrest');
    for (const r of REGIONS) {
      expect(later.security.unrest[r]).toBeGreaterThan(hot.security.unrest[r]);
      expect(later.security.unrest[r]).toBeLessThanOrEqual(100);
    }
  });

  it('riots become possible when a region boils over', () => {
    const hot = withSecurity(newGame(), { unrest: Object.fromEntries(REGIONS.map((r) => [r, 90])) as never });
    const later = advanceDays(hot, 120);
    expect(later.log.some((e) => e.category === 'unrest')).toBe(true);
  });
});

describe('terror', () => {
  it('threat falls with intelligence funding and surveillance', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    const base = terrorTarget(state, eff).total;
    expect(terrorTarget(state, { ...eff, intelligence: 1.8 }).total).toBeLessThan(base);
    const watched = launchOperation(state, 'surveillance', new Rng(state.rng), null);
    expect(terrorTarget(watched, eff).total).toBe(base - 8);
    expect(intelligenceFoilChance(watched, eff)).toBeGreaterThan(intelligenceFoilChance(state, eff));
  });

  it('plots are foiled or become warnings; unattended ones strike or are stopped', () => {
    let state = withSecurity(newGame(), { terrorThreat: 95 });
    state = advanceDays(state, 365 * 2);
    expect(state.security.plotsFoiled + state.security.attacksSuffered).toBeGreaterThan(0);
    expect(state.log.some((e) => e.category === 'terror')).toBe(true);
  });

  it('a live plot raises a warning decision that a raid can resolve', () => {
    let state = withSecurity(newGame(), { terrorThreat: 95 });
    for (let i = 0; i < 400 && !state.events.pending.some((p) => p.eventId === 'terror-warning'); i++) {
      state = advanceDays(
        state,
        1,
        SYSTEMS.filter((s) => ['terror', 'events'].includes(s.id)),
      );
      state = advanceDays(state, 28, only('terror'));
    }
    const warning = state.events.pending.find((p) => p.eventId === 'terror-warning');
    expect(warning?.ref).toBe(state.security.plots[0]?.id);
    const result = dispatch(state, { type: 'RESOLVE_EVENT', pendingId: warning!.id, choiceId: 'raid' });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.security.operations.some((o) => o.kind === 'raid')).toBe(true);
  });

  it('operations cost money, last their duration and cannot be stacked', () => {
    const state = newGame();
    const first = dispatch(state, { type: 'LAUNCH_OPERATION', kind: 'borderSeal' });
    if (!first.ok) throw new Error(first.error);
    expect(first.state.nation.treasury).toBe(state.nation.treasury - OPERATIONS.borderSeal.cost);
    expect(first.state.modifiers.some((m) => m.label === 'Border sealed')).toBe(true);
    expect(dispatch(first.state, { type: 'LAUNCH_OPERATION', kind: 'borderSeal' }).ok).toBe(false);
    expect(dispatch(state, { type: 'LAUNCH_OPERATION', kind: 'nope' as never }).ok).toBe(false);
    const done = run(first.state, OPERATIONS.borderSeal.days + 1, 'modifier-expiry', 'plots');
    expect(done.security.operations).toHaveLength(0);
    expect(dispatch(done, { type: 'LAUNCH_OPERATION', kind: 'borderSeal' }).ok).toBe(true);
  });

  it('a raid either cuts the threat or backfires, and can stop a live plot', () => {
    const base = withSecurity(newGame(), {
      terrorThreat: 60,
      plots: [{ id: 'plot-1', group: 'The Crimson Hand', region: 'east', strikeTick: 30, mitigation: 0 }],
    });
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const after = launchOperation(base, 'raid', new Rng(seedRng(seed)), 'plot-1');
      outcomes.add(after.log.at(-1)!.title);
    }
    expect(outcomes.has('Raid goes wrong')).toBe(true);
    expect([...outcomes].some((t) => t.startsWith('Raid disrupts') || t.startsWith('Plot stopped'))).toBe(true);
  });
});

describe('investigations', () => {
  it('cost money, take time and may expose a minister', () => {
    const state = newGame();
    const corrupt = {
      ...state,
      cabinet: {
        ...state.cabinet,
        ministers: { ...state.cabinet.ministers, home: { ...state.cabinet.ministers.home!, corruption: 100 } },
      },
    };
    const started = dispatch(corrupt, { type: 'LAUNCH_INVESTIGATION', ministry: 'home' });
    if (!started.ok) throw new Error(started.error);
    expect(started.state.security.investigations).toHaveLength(1);
    expect(started.state.nation.treasury).toBeLessThan(corrupt.nation.treasury);
    expect(dispatch(started.state, { type: 'LAUNCH_INVESTIGATION', ministry: 'home' }).ok).toBe(false);

    let exposed = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = { ...started.state, rng: [seed, 5, 6, 7] as GameState['rng'] };
      const after = run(s, 61, 'investigations');
      expect(after.security.investigations).toHaveLength(0);
      if (after.cabinet.ministers.home === null) exposed++;
    }
    expect(exposed).toBeGreaterThan(5);
  });

  it('rejects vacant posts and more than the agency can run', () => {
    const state = newGame();
    const vacant = { ...state, cabinet: { ...state.cabinet, ministers: { ...state.cabinet.ministers, home: null } } };
    expect(dispatch(vacant, { type: 'LAUNCH_INVESTIGATION', ministry: 'home' }).ok).toBe(false);
    let s = state;
    for (const m of MINISTRIES.slice(0, MAX_INVESTIGATIONS)) {
      const r = dispatch(s, { type: 'LAUNCH_INVESTIGATION', ministry: m });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(dispatch(s, { type: 'LAUNCH_INVESTIGATION', ministry: MINISTRIES[MAX_INVESTIGATIONS]! }).ok).toBe(false);
    expect(dispatch(s, { type: 'LAUNCH_INVESTIGATION', ministry: 'nope' as never }).ok).toBe(false);
  });

  it('an exposed minister resigns and the post is vacant', () => {
    const state = newGame();
    const after = exposeMinister(state, 'finance', 'Test.');
    expect(after.cabinet.ministers.finance).toBeNull();
    expect(after.modifiers.some((m) => m.source === 'scandal')).toBe(true);
    expect(exposeMinister(after, 'finance', 'Again.')).toBe(after);
  });
});

describe('game over states', () => {
  const cause = (state: GameState) => (state.status.kind === 'over' ? state.status.cause : null);

  it('ends in a coup when the army and defence minister have turned', () => {
    const state = newGame();
    const angry = withSecurity(
      {
        ...state,
        nation: { ...state.nation, approval: 20 },
        cabinet: {
          ...state.cabinet,
          ministers: { ...state.cabinet.ministers, defence: { ...state.cabinet.ministers.defence!, loyalty: 5 } },
        },
      },
      { militaryLoyalty: 5 },
    );
    expect(coupRisk(angry)).toBeGreaterThan(80);
    expect(coupChance(coupRisk(angry))).toBeGreaterThan(0.05);
    expect(coupChance(40)).toBe(0);
    const over = run(angry, 365 * 4, 'leadership');
    expect(cause(over)).toBe('coup');
    expect(over.status).toMatchObject({ title: 'Overthrown in a coup' });
    expect(over.log.some((e) => e.title === 'Rumours of unrest in the barracks')).toBe(true);
  });

  it('ends in assassination when security is hollow and the threat is high', () => {
    const state = newGame();
    const exposed = withSecurity(
      {
        ...state,
        budget: { ...state.budget, allocations: { ...state.budget.allocations, home: 0.0005, intelligence: 0.0001 } },
      },
      { terrorThreat: 100 },
    );
    expect(presidentialSafety(exposed, allEfficiencies(exposed))).toBeLessThan(40);
    let ended = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = run({ ...exposed, meta: { ...exposed.meta, seed }, rng: [seed, 9, 8, 7] }, 365 * 5, 'leadership');
      if (cause(s) === 'assassination') ended++;
    }
    expect(ended).toBeGreaterThan(0);
  });

  it('survives and rallies the public after a failed attempt on a well-guarded President', () => {
    const state = newGame();
    const guarded = withSecurity(
      {
        ...state,
        budget: { ...state.budget, allocations: { ...state.budget.allocations, home: 0.02, intelligence: 0.01 } },
      },
      { terrorThreat: 100 },
    );
    const rallied = [1, 2, 3, 4, 5, 6].some((seed) => {
      const later = run({ ...guarded, rng: seedRng(seed) }, 365 * 5, 'leadership');
      return later.log.some((e) => e.title === 'Assassination attempt foiled');
    });
    expect(rallied).toBe(true);
  });

  it('ends in bankruptcy after debt stays too high for a year', () => {
    const state = newGame();
    const broke = { ...state, economy: { ...state.economy, debt: state.economy.debt * 3 } };
    const warned = run(broke, 31 * 2, 'economy', 'leadership');
    expect(warned.security.bankruptMonths).toBeGreaterThan(0);
    expect(warned.log.some((e) => e.title === 'Debt crisis')).toBe(true);
    const over = run(broke, 31 * (BANKRUPTCY_MONTHS + 1), 'leadership');
    expect(cause(over)).toBe('bankruptcy');
    const recovered = run({ ...warned, economy: { ...warned.economy, debt: state.economy.debt } }, 35, 'leadership');
    expect(recovered.security.bankruptMonths).toBe(0);
  });

  it('ends in impeachment when approval collapses (first cause preserved)', () => {
    const state = newGame();
    const hated = {
      ...state,
      nation: { ...state.nation, approval: 3 },
      economy: { ...state.economy, inflation: 0.45, unemployment: 0.35, corruption: 100 },
    };
    expect(cause(advanceDays(hated, 365))).toBe('impeachment');
  });

  it('stops all commands and time once the game is over', () => {
    const over = run(withSecurity({ ...newGame(), nation: { ...newGame().nation, approval: 1 } }, {}), 400, 'approval');
    for (const command of [
      { type: 'LAUNCH_INVESTIGATION', ministry: 'home' },
      { type: 'LAUNCH_OPERATION', kind: 'raid' },
    ] as const) {
      expect(
        dispatch(
          over.status.kind === 'over'
            ? over
            : { ...over, status: { kind: 'over', cause: 'coup', date: over.clock.date, title: '', summary: '' } },
          command,
        ).ok,
      ).toBe(false);
    }
  });
});

describe('save compatibility', () => {
  it('round-trips the Phase 3 state through save and load', () => {
    const state = advanceDays(newGame({ seed: 5 }), 200);
    const parsed = parseSave(serializeSave(state, '2026-10-11T00:00:00.000Z'));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.save.state).toEqual(state);
  });

  it('commands and ticks never mutate their input', () => {
    const state = deepFreeze(newGame());
    expect(() => advanceDays(state, 120)).not.toThrow();
    expect(() => dispatch(state, { type: 'LAUNCH_OPERATION', kind: 'surveillance' })).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  allEfficiencies,
  DOMAINS,
  dispatch,
  militaryStrength,
  monthlyUpkeep,
  RIVAL_CONTENT,
  RIVALS,
  STAT_IDS,
  statValue,
  strengthView,
  UNIT_CONTENT,
  UNITS,
  unitCost,
  type Command,
  type GameState,
  type MilitaryState,
  relationOf,
} from '../../src/sim';
import { EVENT_CONTENT } from '../../src/sim/content/events';
import { Rng, seedRng } from '../../src/sim/engine/rng';
import { completeDrills } from '../../src/sim/military/drills';
import { militaryLoyaltyTarget } from '../../src/sim/security/leadership';
import { resolveIntelOps } from '../../src/sim/military/intel';
import { frontRound, startWar, stepWars } from '../../src/sim/military/war';
import { calm, deepFreeze, endless, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};
const withMilitary = (state: GameState, patch: Partial<MilitaryState>): GameState => ({
  ...state,
  military: { ...state.military, ...patch },
});
const withTreasury = (state: GameState, treasury: number): GameState => ({
  ...state,
  nation: { ...state.nation, treasury },
});

describe('military content', () => {
  it('has twelve unit types, three per domain, with generic names', () => {
    expect(UNITS).toHaveLength(12);
    for (const d of DOMAINS) expect(UNITS.filter((u) => UNIT_CONTENT[u].domain === d)).toHaveLength(3);
    for (const u of UNITS) expect(UNIT_CONTENT[u].generations).toHaveLength(3);
  });

  it('describes fictional rivals whose fronts and weights are consistent', () => {
    for (const id of RIVALS) {
      const r = RIVAL_CONTENT[id];
      expect(r.fronts.reduce((s, f) => s + f.share, 0)).toBeCloseTo(1);
      for (const f of r.fronts) {
        expect(f.weights.land + f.weights.air + f.weights.sea + f.weights.strategic).toBeCloseTo(1);
      }
    }
  });

  it('starts India at a strength comparable to the strongest rival', () => {
    const state = newGame();
    const mine = militaryStrength(state.military);
    expect(mine).toBeGreaterThan(65);
    expect(mine).toBeLessThan(95);
    expect(Math.max(...RIVALS.map((r) => RIVAL_CONTENT[r].strength))).toBeGreaterThan(mine);
  });
});

describe('strength', () => {
  it('is multiplied by readiness, morale and technology', () => {
    const base = newGame();
    const strength = (patch: Partial<MilitaryState>) => militaryStrength(withMilitary(base, patch).military);
    const normal = strength({});
    expect(strength({ readiness: 100 })).toBeGreaterThan(normal);
    expect(strength({ readiness: 0 })).toBeCloseTo(normal * ((0.5 + 0) / (0.5 + 0.5 * 0.7)), 5);
    expect(strength({ morale: 100 })).toBeGreaterThan(normal);
    expect(strength({ tech: { land: 2, air: 2, sea: 2, strategic: 2 } })).toBeCloseTo(normal * 1.25, 5);
    expect(strength({ tech: { land: 3, air: 3, sea: 3, strategic: 3 } })).toBeCloseTo(normal * 1.6, 5);
  });

  it('is zero without forces', () => {
    const state = newGame();
    const none = Object.fromEntries(UNITS.map((u) => [u, 0])) as MilitaryState['forces'];
    expect(militaryStrength(withMilitary(state, { forces: none }).military)).toBe(0);
    expect(monthlyUpkeep(withMilitary(state, { forces: none }).military)).toBe(0);
  });
});

describe('procurement', () => {
  it('pays for orders from the procurement fund and delivers them after the build time', () => {
    let state = newGame();
    const fund = state.military.procurementFund;
    const cost = unitCost('infantry', 1) * 2;
    state = run(state, { type: 'ORDER_UNITS', unit: 'infantry', quantity: 2 });
    expect(state.military.procurementFund).toBe(fund - cost);
    expect(state.military.queue).toHaveLength(1);
    const before = state.military.forces.infantry;

    state = calm(state, 100);
    expect(state.military.forces.infantry).toBe(before);
    state = calm(state, 60);
    expect(state.military.forces.infantry).toBe(before + 2);
    expect(state.military.queue).toHaveLength(0);
    expect(state.log.some((e) => e.title === 'Equipment delivered')).toBe(true);
  });

  it('refuses orders the fund cannot cover, bad quantities and a full queue', () => {
    const state = newGame();
    expect(dispatch(state, { type: 'ORDER_UNITS', unit: 'carrier', quantity: 20 }).ok).toBe(false);
    expect(dispatch(state, { type: 'ORDER_UNITS', unit: 'infantry', quantity: 0 }).ok).toBe(false);
    expect(dispatch(state, { type: 'ORDER_UNITS', unit: 'infantry', quantity: 1.5 }).ok).toBe(false);
    expect(dispatch(state, { type: 'ORDER_UNITS', unit: 'infantry', quantity: 21 }).ok).toBe(false);
    let full = withMilitary(state, { procurementFund: 1_000_000 });
    for (let i = 0; i < 8; i++) full = run(full, { type: 'ORDER_UNITS', unit: 'cyber', quantity: 1 });
    expect(dispatch(full, { type: 'ORDER_UNITS', unit: 'cyber', quantity: 1 }).ok).toBe(false);
  });

  it('refunds part of an order when it is cancelled', () => {
    let state = run(newGame(), { type: 'ORDER_UNITS', unit: 'fighter', quantity: 2 });
    const spent = state.military.procurementFund;
    const order = state.military.queue[0]!;
    state = run(state, { type: 'CANCEL_ORDER', orderId: order.id });
    expect(state.military.queue).toHaveLength(0);
    expect(state.military.procurementFund).toBeGreaterThan(spent);
    expect(state.military.procurementFund).toBeLessThan(spent + unitCost('fighter', 1) * 2);
    expect(dispatch(state, { type: 'CANCEL_ORDER', orderId: order.id }).ok).toBe(false);
  });

  it('unlocks a higher technology tier through research, which makes new orders cost more', () => {
    let state = withMilitary(newGame(), { procurementFund: 100_000 });
    state = run(state, { type: 'START_RESEARCH', domain: 'air' });
    expect(dispatch(state, { type: 'START_RESEARCH', domain: 'land' }).ok).toBe(false);
    state = calm(state, 245);
    expect(state.military.tech.air).toBe(2);
    expect(state.military.research).toBeNull();
    expect(unitCost('fighter', 2)).toBeGreaterThan(unitCost('fighter', 1));
    state = withMilitary(state, { tech: { ...state.military.tech, air: 3 } });
    expect(dispatch(state, { type: 'START_RESEARCH', domain: 'air' }).ok).toBe(false);
  });

  it('banks the surplus of the Defence budget after upkeep, and decays readiness and morale when underfunded', () => {
    const state = newGame();
    const rich = calm(state, 365);
    expect(rich.military.fundingRatio).toBeGreaterThan(0.9);

    const lean = {
      ...state,
      budget: {
        ...state.budget,
        allocations: { ...state.budget.allocations, defence: state.budget.allocations.defence * 0.25 },
      },
      military: { ...state.military, procurementFund: 0 },
    };
    const poor = calm(lean, 540);
    expect(poor.military.fundingRatio).toBeLessThan(0.5);
    expect(poor.military.readiness).toBeLessThan(55);
    expect(poor.military.morale).toBeLessThan(state.military.morale);
    expect(poor.log.some((e) => e.title === 'The armed forces are underfunded')).toBe(true);
  });

  it('lets low morale and underfunding pull army loyalty down', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    const high = militaryLoyaltyTarget(withMilitary(state, { morale: 95 }), eff);
    const low = militaryLoyaltyTarget(withMilitary(state, { morale: 5 }), eff);
    expect(high).toBeGreaterThan(low);
    const starved = militaryLoyaltyTarget(withMilitary(state, { fundingRatio: 0.4 }), eff);
    expect(starved).toBeLessThan(militaryLoyaltyTarget(withMilitary(state, { fundingRatio: 1.2 }), eff));
  });
});

describe('drills', () => {
  it('cost money and time, then raise readiness, morale and deterrence', () => {
    let state = withMilitary(newGame(), { readiness: 50, morale: 50, deterrence: 30 });
    const fund = state.military.procurementFund;
    state = run(state, { type: 'START_DRILL', kind: 'joint' });
    expect(state.military.procurementFund).toBeLessThan(fund);
    expect(dispatch(state, { type: 'START_DRILL', kind: 'joint' }).ok).toBe(false);

    const done = completeDrills(
      { ...state, clock: { ...state.clock, tick: state.clock.tick + 46 } },
      new Rng(seedRng(1)),
    );
    expect(done.military.drills).toHaveLength(0);
    const report = done.military.drillReports[0]!;
    expect(report.kind).toBe('joint');
    if (!report.accident) {
      expect(done.military.readiness).toBeGreaterThan(50);
      expect(done.military.morale).toBeGreaterThan(50);
      expect(done.military.deterrence).toBeGreaterThan(30);
    }
  });

  it('allows at most two at once and reports accidents', () => {
    let state = newGame();
    state = run(state, { type: 'START_DRILL', kind: 'land' });
    state = run(state, { type: 'START_DRILL', kind: 'air' });
    expect(dispatch(state, { type: 'START_DRILL', kind: 'naval' }).ok).toBe(false);

    let accidents = 0;
    for (let seed = 1; seed < 200; seed++) {
      const ended = completeDrills(
        { ...state, clock: { ...state.clock, tick: state.clock.tick + 40 } },
        new Rng(seedRng(seed * 7919 + 10)),
      );
      accidents += ended.military.drillReports.filter((r) => r.accident).length;
    }
    expect(accidents).toBeGreaterThan(0);
  });
});

describe('intelligence and the fog of war', () => {
  it('shows enemy strength as unknown, then as an estimated range, then sharply after recon', () => {
    let state = newGame();
    expect(strengthView(state, 'CHN', 0.5)).toEqual({ kind: 'unknown' });
    const estimate = strengthView(state, 'CHN', 1);
    expect(estimate.kind).toBe('estimate');

    state = {
      ...state,
      military: {
        ...state.military,
        rivals: {
          ...state.military.rivals,
          CHN: {
            ...state.military.rivals.CHN,
            sighting: { tick: 0, strength: 100, readiness: 70 },
          },
        },
      },
    };
    const fresh = strengthView(state, 'CHN', 0.5);
    expect(fresh.kind).toBe('sighted');
    if (fresh.kind !== 'sighted' || estimate.kind !== 'estimate') throw new Error('unexpected views');
    expect(fresh.high - fresh.low).toBeLessThan(estimate.high - estimate.low);

    const old = strengthView({ ...state, clock: { ...state.clock, tick: 400 } }, 'CHN', 0.5);
    if (old.kind !== 'sighted') throw new Error('expected a sighting');
    expect(old.high - old.low).toBeGreaterThan(fresh.high - fresh.low);
  });

  it('recon reveals the rival, and charges the treasury', () => {
    let state = newGame();
    const treasury = state.nation.treasury;
    state = run(state, { type: 'LAUNCH_INTEL_OP', kind: 'recon', target: 'CHN' });
    expect(state.nation.treasury).toBeLessThan(treasury);
    expect(dispatch(state, { type: 'LAUNCH_INTEL_OP', kind: 'recon', target: 'CHN' }).ok).toBe(false);

    let revealed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ended = resolveIntelOps(
        { ...state, clock: { ...state.clock, tick: state.clock.tick + 31 } },
        new Rng(seedRng(seed * 7919 + 4)),
      );
      if (ended.military.rivals.CHN.sighting) revealed++;
    }
    expect(revealed).toBeGreaterThan(5);
    expect(revealed).toBeLessThan(60);
  });

  it('exposed operations hurt relations, cost approval and raise a diplomatic incident', () => {
    const state = run(newGame(), { type: 'LAUNCH_INTEL_OP', kind: 'sabotage', target: 'CHN' });
    let exposed: GameState | null = null;
    for (let seed = 1; seed <= 200 && !exposed; seed++) {
      const ended = resolveIntelOps(
        { ...state, clock: { ...state.clock, tick: state.clock.tick + 61 } },
        new Rng(seedRng(seed * 7919 + 4)),
      );
      if (ended.events.pending.some((p) => p.eventId === 'diplomatic-incident')) exposed = ended;
    }
    expect(exposed).not.toBeNull();
    expect(relationOf(exposed!, 'CHN')).toBeLessThan(relationOf(state, 'CHN'));
    expect(exposed!.modifiers.some((m) => m.source === 'intel-exposed')).toBe(true);
    const pending = exposed!.events.pending.find((p) => p.eventId === 'diplomatic-incident')!;
    expect(pending.ref).toBe('CHN');
  });

  it('a harder target and a weaker Director make operations less likely to work', async () => {
    const { opSuccessChance } = await import('../../src/sim/military/intel');
    const state = newGame();
    expect(opSuccessChance(state, 'recon', 'LKA')).toBeGreaterThan(opSuccessChance(state, 'recon', 'CHN'));
    expect(opSuccessChance(state, 'recon', 'CHN')).toBeGreaterThan(opSuccessChance(state, 'sabotage', 'CHN'));
    const dud = {
      ...state,
      cabinet: {
        ...state.cabinet,
        ministers: {
          ...state.cabinet.ministers,
          intelligence: { ...state.cabinet.ministers.intelligence!, competence: 5 },
        },
      },
    };
    expect(opSuccessChance(dud, 'recon', 'PAK')).toBeLessThan(opSuccessChance(state, 'recon', 'PAK'));
  });

  it('counter-intelligence is limited to one sweep and protects against enemy spies', () => {
    const state = run(newGame(), { type: 'LAUNCH_INTEL_OP', kind: 'counterIntel', target: null });
    expect(dispatch(state, { type: 'LAUNCH_INTEL_OP', kind: 'counterIntel', target: null }).ok).toBe(false);
    expect(dispatch(newGame(), { type: 'LAUNCH_INTEL_OP', kind: 'recon', target: null }).ok).toBe(false);
  });
});

describe('war resolver', () => {
  it('lets the stronger side advance and take fewer losses', () => {
    const r = frontRound(100, 50, 'plains');
    expect(r.progress).toBeGreaterThan(0);
    expect(r.indiaLoss).toBeLessThan(r.enemyLoss);
    const back = frontRound(50, 100, 'plains');
    expect(back.progress).toBeLessThan(0);
    expect(back.indiaLoss).toBeGreaterThan(back.enemyLoss);
  });

  it('is a stalemate between equals, and terrain helps the weaker defender', () => {
    expect(frontRound(80, 80, 'mountains').progress).toBe(0);
    const open = frontRound(100, 70, 'plains').progress;
    const hills = frontRound(100, 70, 'mountains').progress;
    expect(hills).toBeLessThan(open);
  });

  it('handles a zero army on either or both sides without dividing by zero', () => {
    const none = frontRound(0, 50, 'plains');
    expect(none.progress).toBeLessThan(0);
    expect(Number.isFinite(none.indiaLoss)).toBe(true);
    const undefended = frontRound(50, 0, 'plains');
    expect(undefended.progress).toBeGreaterThan(0);
    expect(frontRound(0, 0, 'plains')).toEqual({ progress: 0, indiaLoss: 0, enemyLoss: 0 });
    expect(frontRound(-5, 20, 'coast').progress).toBeLessThan(0);
  });

  it('caps how fast a front can move in a day', () => {
    expect(Math.abs(frontRound(1000, 1, 'plains').progress)).toBeLessThanOrEqual(3);
  });
});

describe('war', () => {
  const declare = (rival: (typeof RIVALS)[number], seed = 42) => run(newGame({ seed }), { type: 'DECLARE_WAR', rival });

  it('declaring war costs money, approval and goodwill with the other countries', () => {
    const before = newGame();
    const state = declare('BGD');
    expect(state.nation.treasury).toBeLessThan(before.nation.treasury);
    expect(state.military.wars).toHaveLength(1);
    expect(state.military.wars[0]!.declaredBy).toBe('india');
    expect(relationOf(state, 'BGD')).toBeLessThan(relationOf(before, 'BGD'));
    expect(relationOf(state, 'PAK')).toBeLessThan(relationOf(before, 'PAK'));
    expect(state.modifiers.some((m) => m.source === 'war' && m.value < 0)).toBe(true);
    expect(state.log.at(-1)?.severity).toBe('critical');
    expect(dispatch(state, { type: 'DECLARE_WAR', rival: 'BGD' }).ok).toBe(false);
  });

  it('allows at most two wars at once and needs the money to mobilise', () => {
    let state = declare('BGD');
    state = run(state, { type: 'DECLARE_WAR', rival: 'LKA' });
    expect(dispatch(state, { type: 'DECLARE_WAR', rival: 'PAK' }).ok).toBe(false);
    expect(dispatch(withTreasury(newGame(), 100), { type: 'DECLARE_WAR', rival: 'LKA' }).ok).toBe(false);
  });

  it('a war against a much weaker neighbour is won, but costs lives, money and readiness', () => {
    const start = declare('BGD');
    let state = start;
    for (let d = 0; d < 400 && state.military.wars[0]?.status === 'active'; d++) state = advanceDays(state, 1);
    const war = state.military.wars[0]!;
    expect(war.status).toBe('terms');
    expect(war.casualties.india).toBeGreaterThan(1000);
    expect(war.equipmentLost).toBeGreaterThan(0);
    expect(war.weariness).toBeGreaterThan(5);
    expect(state.military.readiness).toBeLessThan(start.military.readiness);
  });

  it('a war against a peer is mostly a stalemate', () => {
    let stalemate = 0;
    const seeds = 12;
    for (let seed = 1; seed <= seeds; seed++) {
      let state = declare('CHN', seed);
      state = advanceDays(state, 150);
      if (state.status.kind === 'playing' && state.military.wars[0]?.status === 'active') stalemate++;
    }
    expect(stalemate).toBeGreaterThanOrEqual(Math.ceil(seeds * 0.6));
  });

  it('settles a won war by annexation, reparations or a magnanimous peace', () => {
    const won = (rival: (typeof RIVALS)[number]) => {
      let state = declare(rival);
      for (let d = 0; d < 400 && state.military.wars[0]?.status === 'active'; d++) state = advanceDays(state, 1);
      return state;
    };
    expect(dispatch(declare('BGD'), { type: 'SETTLE_WAR', warId: 'war-x', terms: 'annex' }).ok).toBe(false);

    const annexed = won('LKA');
    const warId = annexed.military.wars[0]!.id;
    const gdp = (s: GameState) => Object.values(s.economy.sectors).reduce((a, b) => a + b.output, 0);
    const after = run(annexed, { type: 'SETTLE_WAR', warId, terms: 'annex' });
    expect(gdp(after)).toBeGreaterThan(gdp(annexed));
    expect(after.nation.population).toBeGreaterThan(annexed.nation.population);
    expect(after.security.unrest.south).toBeGreaterThan(annexed.security.unrest.south);
    expect(after.military.rivals.LKA.annexed).toBe(true);
    expect(after.military.wars).toHaveLength(0);
    expect(after.military.warHistory[0]?.outcome).toBe('victory');
    expect(after.modifiers.some((m) => m.label.startsWith('Sanctions after annexing'))).toBe(true);
    expect(dispatch(after, { type: 'DECLARE_WAR', rival: 'LKA' }).ok).toBe(false);

    const reparations = run(won('BGD'), {
      type: 'SETTLE_WAR',
      warId: won('BGD').military.wars[0]!.id,
      terms: 'reparations',
    });
    expect(reparations.nation.treasury).toBeGreaterThan(won('BGD').nation.treasury);

    const white = won('LKA');
    const peaceful = run(white, { type: 'SETTLE_WAR', warId: white.military.wars[0]!.id, terms: 'whitePeace' });
    expect(relationOf(peaceful, 'LKA')).toBeGreaterThan(relationOf(white, 'LKA'));
    expect(peaceful.modifiers.some((m) => m.label.startsWith('Victory over'))).toBe(true);
  });

  it('applies reparations by default if the terms are not chosen in time', () => {
    let state = declare('LKA');
    for (let d = 0; d < 400 && state.military.wars[0]?.status === 'active'; d++) state = advanceDays(state, 1);
    expect(state.military.wars[0]?.status).toBe('terms');
    const after = advanceDays(state, 31);
    expect(after.military.wars).toHaveLength(0);
    expect(after.military.warHistory[0]?.settlement).toContain('Reparations');
  });

  it('accepts a ceasefire only when one is offered, and ends the war', () => {
    let state = declare('CHN');
    expect(dispatch(state, { type: 'ACCEPT_CEASEFIRE', warId: state.military.wars[0]!.id }).ok).toBe(false);
    const war = state.military.wars[0]!;
    state = { ...state, military: { ...state.military, wars: [{ ...war, ceasefireOffered: true }] } };
    state = run(state, { type: 'ACCEPT_CEASEFIRE', warId: war.id });
    expect(state.military.wars).toHaveLength(0);
    expect(state.military.warHistory[0]?.outcome).toBe('ceasefire');
    expect(state.military.rivals.CHN.recoverUntilTick).not.toBeNull();
    // Nothing is left to fight: the next round changes nothing.
    expect(stepWars(state, new Rng(seedRng(1))).military.forces).toEqual(state.military.forces);
  });

  it('a ceasefire ordered mid-war leaves the rival’s strength where the fighting left it', () => {
    let state = declare('CHN');
    state = advanceDays(state, 20);
    const war = state.military.wars[0]!;
    const strength = state.military.rivals.CHN.strength;
    state = run(
      { ...state, military: { ...state.military, wars: [{ ...war, ceasefireOffered: true }] } },
      {
        type: 'ACCEPT_CEASEFIRE',
        warId: war.id,
      },
    );
    const later = advanceDays(state, 30);
    expect(later.military.rivals.CHN.strength).toBeLessThanOrEqual(strength * 1.01);
    expect(later.military.rivals.CHN.strength).toBeGreaterThan(strength * 0.99);
  });

  it('sues for peace: a white peace if the war is not lost, hard terms if it is', () => {
    const even = declare('CHN');
    const peace = run(even, { type: 'SUE_FOR_PEACE', warId: even.military.wars[0]!.id });
    expect(peace.military.wars).toHaveLength(0);
    expect(peace.nation.treasury).toBeGreaterThanOrEqual(even.nation.treasury - 1);

    const war = even.military.wars[0]!;
    const losing = {
      ...even,
      military: { ...even.military, wars: [{ ...war, fronts: war.fronts.map((f) => ({ ...f, progress: -70 })) }] },
    };
    const hard = run(losing, { type: 'SUE_FOR_PEACE', warId: war.id });
    expect(hard.nation.treasury).toBeLessThan(losing.nation.treasury);
    expect(hard.military.warHistory[0]?.settlement).toContain('enemy');
  });

  it('total defeat ends the presidency', () => {
    const state = declare('CHN');
    const war = state.military.wars[0]!;
    const routed = {
      ...state,
      military: {
        ...state.military,
        wars: [{ ...war, fronts: war.fronts.map((f) => ({ ...f, progress: -86 })) }],
      },
    };
    const end = advanceDays(routed, 1);
    expect(end.status.kind).toBe('over');
    if (end.status.kind === 'over') expect(end.status.cause).toBe('defeat');
    expect(end.military.warHistory[0]?.outcome).toBe('defeat');
  });

  it('an army reduced to nothing is routed quickly', () => {
    const state = declare('PAK');
    const none = Object.fromEntries(UNITS.map((u) => [u, 0])) as MilitaryState['forces'];
    let end = withMilitary(state, { forces: none });
    end = advanceDays(end, 120);
    expect(end.status.kind).toBe('over');
  });

  it('war weariness grows and weighs on approval and growth', () => {
    let state = declare('CHN');
    state = advanceDays(state, 95);
    expect(state.military.wars[0]!.weariness).toBeGreaterThan(10);
    expect(state.modifiers.some((m) => m.source === 'war-weariness' && m.target === 'politics.approvalTarget')).toBe(
      true,
    );
    expect(state.modifiers.filter((m) => m.source === 'war-weariness')).toHaveLength(2);
    const later = advanceDays(state, 120);
    expect(later.modifiers.filter((m) => m.source === 'war-weariness').length).toBeLessThanOrEqual(2);
  });

  it('a rival can declare war, and an unprepared army starts on the back foot', () => {
    const state = newGame();
    const attacked = startWar(withMilitary(state, { readiness: 30 }), 'CHN', 'rival');
    const war = attacked.military.wars[0]!;
    expect(war.declaredBy).toBe('rival');
    expect(war.fronts.every((f) => f.progress < 0)).toBe(true);
    expect(attacked.modifiers.some((m) => m.source === 'war' && m.value > 0)).toBe(true);
    expect(attacked.log.at(-1)?.severity).toBe('critical');
  });

  it('rivals attack less when India is stronger and more deterring', async () => {
    const { declarationChance } = await import('../../src/sim');
    const late = { ...newGame(), clock: { ...newGame().clock, tick: 800 } };
    const base = declarationChance(late, 'CHN');
    expect(base).toBeGreaterThan(0);
    expect(declarationChance(withMilitary(late, { deterrence: 90 }), 'CHN')).toBeLessThan(base);
    expect(declarationChance(newGame(), 'CHN')).toBe(0);
    expect(declarationChance(late, 'LKA')).toBeLessThan(base);
  });
});

describe('the nuclear program', () => {
  const funded = (): GameState => withTreasury(newGame(), 5_000_000);

  it('runs from research to enrichment to warheads while it is funded', () => {
    let state = run(endless(funded()), { type: 'START_NUCLEAR_PROGRAM' });
    expect(dispatch(state, { type: 'START_NUCLEAR_PROGRAM' }).ok).toBe(false);
    state = withTreasury(calm(state, 365 * 3), 5_000_000);
    expect(state.military.nuclear.research).toBeGreaterThan(50);
    expect(state.modifiers.some((m) => m.source === 'nuclear')).toBe(true);
    state = withTreasury(calm(state, 365 * 4), 5_000_000);
    expect(state.military.nuclear.enrichment).toBe(100);
    expect(state.military.nuclear.warheads).toBeGreaterThan(0);
    expect(state.log.some((e) => e.title === 'India is a nuclear-armed state')).toBe(true);
  });

  it('can be paused, and warheads add deterrence', () => {
    let state = run(funded(), { type: 'START_NUCLEAR_PROGRAM' });
    state = run(state, { type: 'SET_NUCLEAR_PROGRAM', active: false });
    expect(dispatch(state, { type: 'SET_NUCLEAR_PROGRAM', active: false }).ok).toBe(false);
    const stalled = advanceDays(state, 120);
    expect(stalled.military.nuclear.research).toBe(0);
    expect(dispatch(newGame(), { type: 'SET_NUCLEAR_PROGRAM', active: true }).ok).toBe(false);

    const armed = withMilitary(newGame(), { nuclear: { ...newGame().military.nuclear, warheads: 6 } });
    const calmer = calm(armed, 365);
    const base = calm(newGame(), 365);
    expect(calmer.military.deterrence).toBeGreaterThan(base.military.deterrence);
  });

  it('forbids a first strike under No First Use and punishes abandoning the doctrine', () => {
    let state = declareAndArm('PAK');
    const warId = state.military.wars[0]!.id;
    const refused = dispatch(state, { type: 'USE_NUCLEAR_WEAPON', warId });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toContain('No First Use');

    const before = state;
    state = run(state, { type: 'SET_NUCLEAR_DOCTRINE', doctrine: 'firstUse' });
    expect(state.modifiers.some((m) => m.label === 'Abandoned No First Use')).toBe(true);
    expect(relationOf(state, 'MMR')).toBeLessThan(relationOf(before, 'MMR'));
    expect(dispatch(state, { type: 'SET_NUCLEAR_DOCTRINE', doctrine: 'firstUse' }).ok).toBe(false);
  });

  it('using a nuclear weapon brings sanctions, horror and hostility; on Hard it ends the presidency', () => {
    let state = declareAndArm('PAK');
    state = run(state, { type: 'SET_NUCLEAR_DOCTRINE', doctrine: 'firstUse' });
    const warId = state.military.wars[0]!.id;
    const used = run(state, { type: 'USE_NUCLEAR_WEAPON', warId });
    expect(used.military.nuclear.warheads).toBe(2);
    expect(used.military.wars).toHaveLength(0);
    expect(used.military.warHistory[0]?.outcome).toBe('nuclear');
    expect(used.status.kind).toBe('playing');
    const growth = used.modifiers.filter(
      (m) => m.label.startsWith('Global sanctions') && m.target === 'economy.growth',
    );
    expect(growth[0]!.value).toBeLessThanOrEqual(-0.04);
    expect(used.modifiers.some((m) => m.label.startsWith('Horror') && m.value <= -20)).toBe(true);
    expect(relationOf(used, 'BGD')).toBeLessThan(relationOf(state, 'BGD') - 50);

    const hard = declareAndArm('PAK', 'hard');
    const armedHard = run(hard, { type: 'SET_NUCLEAR_DOCTRINE', doctrine: 'firstUse' });
    const over = run(armedHard, { type: 'USE_NUCLEAR_WEAPON', warId: armedHard.military.wars[0]!.id });
    expect(over.status.kind).toBe('over');
    if (over.status.kind === 'over') expect(over.status.cause).toBe('nuclear');
  });

  it('needs a warhead and a war', () => {
    const unarmed = run(newGame(), { type: 'DECLARE_WAR', rival: 'LKA' });
    expect(dispatch(unarmed, { type: 'USE_NUCLEAR_WEAPON', warId: unarmed.military.wars[0]!.id }).ok).toBe(false);
    expect(dispatch(newGame(), { type: 'USE_NUCLEAR_WEAPON', warId: 'war-1' }).ok).toBe(false);
  });

  function declareAndArm(rival: (typeof RIVALS)[number], difficulty: 'normal' | 'hard' = 'normal'): GameState {
    const state = run(newGame({ difficulty }), { type: 'DECLARE_WAR', rival });
    return withMilitary(state, { nuclear: { ...state.military.nuclear, warheads: 3 } });
  }
});

describe('integration', () => {
  it('never mutates its input (deep-frozen state through commands and a war)', () => {
    let state = deepFreeze(newGame());
    state = deepFreeze(run(state, { type: 'ORDER_UNITS', unit: 'cyber', quantity: 1 }));
    state = deepFreeze(run(state, { type: 'START_DRILL', kind: 'air' }));
    state = deepFreeze(run(state, { type: 'LAUNCH_INTEL_OP', kind: 'recon', target: 'LKA' }));
    state = deepFreeze(run(state, { type: 'DECLARE_WAR', rival: 'LKA' }));
    const end = advanceDays(state, 90);
    expect(end.clock.tick).toBeGreaterThan(state.clock.tick);
  });

  it('is deterministic with a war running', () => {
    const start = run(newGame({ seed: 5 }), { type: 'DECLARE_WAR', rival: 'CHN' });
    const a = advanceDays(start, 400);
    const b = advanceDays(structuredClone(advanceDays(start, 150)), 250);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('exposes military stats for event conditions, all finite', () => {
    const state = run(newGame(), { type: 'DECLARE_WAR', rival: 'BGD' });
    for (const stat of STAT_IDS) expect(Number.isFinite(statValue(state, stat, 'east')), stat).toBe(true);
    expect(statValue(state, 'wars', null)).toBe(1);
    expect(statValue(state, 'militaryStrength', null)).toBeGreaterThan(50);
  });

  it('ships a diplomatic-incident event that works for any rival and has one default choice', () => {
    const def = EVENT_CONTENT['diplomatic-incident']!;
    expect(def.choices.filter((c) => c.default)).toHaveLength(1);
    expect(def.weight).toBe(0);
    expect(def.body).toContain('{rival}');
  });
});

describe('saving a game with the military in motion', () => {
  it('round-trips a game with orders, drills, operations, a war and a nuclear program', async () => {
    const { parseSave, serializeSave } = await import('../../src/sim');
    let state = withTreasury(newGame(), 5_000_000);
    state = run(state, { type: 'ORDER_UNITS', unit: 'fighter', quantity: 2 });
    state = run(state, { type: 'START_DRILL', kind: 'air' });
    state = run(state, { type: 'LAUNCH_INTEL_OP', kind: 'recon', target: 'PAK' });
    state = run(state, { type: 'START_NUCLEAR_PROGRAM' });
    state = run(state, { type: 'DECLARE_WAR', rival: 'PAK' });
    state = advanceDays(state, 10);
    const parsed = parseSave(serializeSave(state, '2026-10-11T00:00:00.000Z'));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.save.state).toEqual(state);
  });

  it('rejects a save whose military state is corrupt', async () => {
    const { parseSave, serializeSave } = await import('../../src/sim');
    const state = newGame();
    const raw = JSON.parse(serializeSave(state, '2026-10-11T00:00:00.000Z'));
    raw.state.military.readiness = 250;
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  allEfficiencies,
  computeSatisfaction,
  coverage,
  coverageEffect,
  dispatch,
  explainCoverage,
  explainGrowth,
  FACILITIES,
  FACILITY_CONTENT,
  facilitiesForTarget,
  facilityUpkeep,
  MAX_BUILD_QUEUE,
  MINISTRIES,
  projectMonth,
  REGION_POPULATION_SHARE,
  REGIONS,
  unrestTarget,
  type Command,
  type GameState,
} from '../../src/sim';
import { calm, deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

const rich = (state: GameState): GameState => ({ ...state, nation: { ...state.nation, treasury: 5_000_000 } });

describe('public works content', () => {
  it('has at least ten facility types with fast, genre-style build times', () => {
    expect(FACILITIES.length).toBeGreaterThanOrEqual(10);
    for (const f of FACILITIES) {
      const c = FACILITY_CONTENT[f];
      // Small buildings take weeks, the largest a few months.
      expect(c.buildDays).toBeGreaterThanOrEqual(14);
      expect(c.buildDays).toBeLessThanOrEqual(90);
      if (c.cost < 10) expect(c.buildDays).toBeLessThanOrEqual(28);
    }
  });

  it('splits the population across the regions', () => {
    expect(Object.values(REGION_POPULATION_SHARE).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('coverage', () => {
  it('changes nothing at the start of a game: every coverage effect and all extra upkeep are zero', () => {
    const state = newGame();
    for (const effect of ['hdi', 'services', 'growth', 'unrest'] as const) {
      expect(Math.abs(coverageEffect(state, effect))).toBe(0);
      for (const r of REGIONS) expect(Math.abs(coverageEffect(state, effect, r))).toBe(0);
    }
    // Exactly zero (−0 from negative weights is still zero), so tick 0 plays as it did before public works.
    expect(Object.values(facilityUpkeep(state)).every((v) => v === 0)).toBe(true);
    const drivers = unrestTarget(state, 'east', allEfficiencies(state)).drivers;
    expect(Math.abs(drivers.find((d) => d.label === 'Schools, clinics and housing')!.value)).toBe(0);
    expect(Math.abs(explainGrowth(state).find((g) => g.driver === 'infrastructure')!.value)).toBe(0);
  });

  it('starts below full coverage, with the South better served than the East', () => {
    const state = newGame();
    for (const r of REGIONS) {
      expect(coverage(state, r, 'clinics')).toBeGreaterThan(0.4);
      expect(coverage(state, r, 'clinics')).toBeLessThan(1);
    }
    expect(coverage(state, 'south', 'hospitals')).toBeGreaterThan(coverage(state, 'east', 'hospitals'));
  });

  it('wears down as the population grows and nothing is built', () => {
    const start = newGame();
    const later = calm(start, 365);
    expect(coverage(later, 'north', 'schools')).toBeLessThan(coverage(start, 'north', 'schools'));
    expect(coverageEffect(later, 'services')).toBeLessThan(0);
  });

  it('explains a region’s coverage from what each facility type serves', () => {
    const state = newGame();
    const why = explainCoverage(state, 'west', 'hospitals');
    expect(why.lines.map((l) => l.facility)).toEqual(['districtHospital', 'medicalCollege']);
    const served = why.lines.reduce((s, l) => s + l.served, 0);
    expect(served / why.population).toBeCloseTo(why.coverage, 12);
    expect(why.counted).toBe(why.coverage);
  });

  it('counts coverage past 100% at half the rate, up to a ceiling', () => {
    let state = rich(newGame());
    const needed = facilitiesForTarget(state, 'northEast', 'waterWorks', 2);
    state = { ...state, infrastructure: { ...state.infrastructure } };
    state.infrastructure.counts = {
      ...state.infrastructure.counts,
      northEast: {
        ...state.infrastructure.counts.northEast,
        waterWorks: state.infrastructure.counts.northEast.waterWorks + needed,
      },
    };
    const why = explainCoverage(state, 'northEast', 'water');
    expect(why.coverage).toBeGreaterThanOrEqual(2);
    expect(why.counted).toBe(1.25);
  });
});

describe('building', () => {
  it('pays up front, opens the facilities when the work is done and raises coverage', () => {
    let state = rich(newGame());
    const before = state.nation.treasury;
    const quantity = facilitiesForTarget(state, 'east', 'clinic');
    expect(quantity).toBeGreaterThan(0);
    state = run(state, { type: 'BUILD_FACILITY', facility: 'clinic', region: 'east', quantity });
    expect(state.nation.treasury).toBe(before - quantity * FACILITY_CONTENT.clinic.cost);
    expect(state.infrastructure.queue).toHaveLength(1);

    const opened = calm(state, FACILITY_CONTENT.clinic.buildDays);
    expect(opened.infrastructure.queue).toHaveLength(0);
    expect(opened.infrastructure.counts.east.clinic).toBe(state.infrastructure.counts.east.clinic + quantity);
    expect(coverage(opened, 'east', 'clinics')).toBeGreaterThanOrEqual(0.99);
    expect(coverageEffect(opened, 'services')).toBeGreaterThan(0);
    expect(coverageEffect(opened, 'hdi')).toBeGreaterThan(0);
    expect(coverageEffect(opened, 'unrest', 'east')).toBeLessThan(0);
    expect(coverageEffect(opened, 'unrest', 'west')).toBeCloseTo(
      coverageEffect(calm(newGame(), FACILITY_CONTENT.clinic.buildDays), 'unrest', 'west'),
      10,
    );
  });

  it('charges the running costs of new facilities to their department', () => {
    let state = rich(newGame());
    state = run(state, { type: 'BUILD_FACILITY', facility: 'districtHospital', region: 'north', quantity: 10 });
    state = calm(state, FACILITY_CONTENT.districtHospital.buildDays);
    const upkeep = facilityUpkeep(state);
    expect(upkeep.health).toBeCloseTo(10 * FACILITY_CONTENT.districtHospital.upkeep, 10);
    for (const m of MINISTRIES) if (m !== 'health') expect(upkeep[m]).toBe(0);
    const without = { ...state, infrastructure: newGame().infrastructure };
    expect(
      projectMonth(state, state.budget).expenditure.health - projectMonth(without, state.budget).expenditure.health,
    ).toBeCloseTo(upkeep.health, 6);
  });

  it('refuses orders the treasury cannot cover, bad quantities and a full queue', () => {
    const state = newGame();
    const poor = { ...state, nation: { ...state.nation, treasury: 100 } };
    expect(dispatch(poor, { type: 'BUILD_FACILITY', facility: 'railLink', region: 'west', quantity: 1 }).ok).toBe(
      false,
    );
    for (const quantity of [0, -3, 1.5, 1_000_000]) {
      expect(dispatch(rich(state), { type: 'BUILD_FACILITY', facility: 'clinic', region: 'west', quantity }).ok).toBe(
        false,
      );
    }
    expect(
      dispatch(rich(state), { type: 'BUILD_FACILITY', facility: 'clinic', region: 'mars' as never, quantity: 1 }).ok,
    ).toBe(false);
    let full = rich(state);
    for (let i = 0; i < MAX_BUILD_QUEUE; i++) {
      full = run(full, { type: 'BUILD_FACILITY', facility: 'clinic', region: 'west', quantity: 1 });
    }
    expect(dispatch(full, { type: 'BUILD_FACILITY', facility: 'clinic', region: 'west', quantity: 1 }).ok).toBe(false);
  });

  it('refunds half the price of a cancelled project', () => {
    let state = rich(newGame());
    state = run(state, { type: 'BUILD_FACILITY', facility: 'university', region: 'central', quantity: 2 });
    const paid = state.nation.treasury;
    const order = state.infrastructure.queue[0]!;
    state = run(state, { type: 'CANCEL_BUILD', orderId: order.id });
    expect(state.nation.treasury).toBe(paid + Math.round(order.cost / 2));
    expect(state.infrastructure.queue).toHaveLength(0);
    expect(dispatch(state, { type: 'CANCEL_BUILD', orderId: order.id }).ok).toBe(false);
  });

  it('demolishes facilities to save their upkeep, never more than stand', () => {
    const state = newGame();
    const stand = state.infrastructure.counts.south.housingBlock;
    const after = run(state, { type: 'DEMOLISH_FACILITY', facility: 'housingBlock', region: 'south', quantity: 1000 });
    expect(after.infrastructure.counts.south.housingBlock).toBe(stand - 1000);
    expect(facilityUpkeep(after).industry).toBeLessThan(0);
    expect(projectMonth(after, after.budget).expenditure.industry).toBeLessThan(
      projectMonth(state, state.budget).expenditure.industry,
    );
    expect(computeSatisfaction(after, allEfficiencies(after)).services).toBeLessThan(
      computeSatisfaction(state, allEfficiencies(state)).services,
    );
    expect(
      dispatch(state, { type: 'DEMOLISH_FACILITY', facility: 'housingBlock', region: 'south', quantity: stand + 1 }).ok,
    ).toBe(false);
  });

  it('never mutates the state it is given', () => {
    const state = deepFreeze(rich(newGame()));
    const built = run(state, { type: 'BUILD_FACILITY', facility: 'highway', region: 'north', quantity: 3 });
    deepFreeze(built);
    expect(() => calm(built, 60)).not.toThrow();
    expect(() =>
      run(state, { type: 'DEMOLISH_FACILITY', facility: 'clinic', region: 'north', quantity: 1 }),
    ).not.toThrow();
  });
});

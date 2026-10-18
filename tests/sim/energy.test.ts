import { describe, expect, it } from 'vitest';
import {
  approvalTarget,
  consumption,
  disasterFactor,
  dispatch,
  emissionsIndex,
  explainGrowth,
  exportedPower,
  exportRevenue,
  governanceLines,
  MAX_PLANT_QUEUE,
  MINISTRIES,
  OPENING_MARGIN,
  PLANT_CONTENT,
  PLANTS,
  plantOutput,
  plantsForMargin,
  plantUpkeep,
  production,
  projectMonth,
  REGIONS,
  shortfall,
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

/** Every region's plants of one type scaled by a factor. */
function scalePlants(state: GameState, plant: (typeof PLANTS)[number], factor: number): GameState {
  const plants = Object.fromEntries(
    REGIONS.map((r) => [r, { ...state.energy.plants[r], [plant]: Math.round(state.energy.plants[r][plant] * factor) }]),
  ) as GameState['energy']['plants'];
  return { ...state, energy: { ...state.energy, plants } };
}

describe('the grid at the start of a game', () => {
  it('has a 5% reserve margin, no shortfall, no exports and no extra upkeep, so tick 0 is unchanged', () => {
    const state = newGame();
    expect(production(state) / consumption(state)).toBeCloseTo(1 + OPENING_MARGIN, 10);
    expect(shortfall(state)).toBe(0);
    expect(exportedPower(state)).toBe(0);
    expect(emissionsIndex(state)).toBe(1);
    expect(disasterFactor(state)).toBe(1);
    expect(Object.values(plantUpkeep(state)).every((v) => v === 0)).toBe(true);
    expect(governanceLines(state)).toEqual([]);
    expect(Math.abs(explainGrowth(state).find((g) => g.driver === 'power')!.value)).toBe(0);
  });

  it('opens with about 183 GW of average output, most of it from coal', () => {
    const state = newGame();
    expect(production(state)).toBeGreaterThan(175);
    expect(production(state)).toBeLessThan(190);
    for (const p of PLANTS)
      expect(plantOutput(p)).toBeCloseTo(PLANT_CONTENT[p].capacity * PLANT_CONTENT[p].capacityFactor, 12);
  });
});

describe('demand and shortfall', () => {
  it('grows with the economy until the grid runs short, which cuts growth and approval', () => {
    const later = calm(newGame(), 365 * 3);
    expect(consumption(later)).toBeGreaterThan(production(later));
    expect(shortfall(later)).toBeGreaterThan(0.02);
    expect(explainGrowth(later).find((g) => g.driver === 'power')!.value).toBeLessThan(0);
    const cuts = governanceLines(later).find((l) => l.label === 'Power cuts');
    expect(cuts?.value).toBeLessThan(0);
    expect(approvalTarget(later, later.politics.satisfaction).breakdown).toContainEqual(cuts);
  });

  it('sells a surplus beyond the reserve margin to neighbours', () => {
    const state = scalePlants(newGame(), 'solar', 3);
    expect(exportedPower(state)).toBeGreaterThan(0);
    expect(
      projectMonth(state, state.budget).revenue.nonTax - projectMonth(newGame(), state.budget).revenue.nonTax,
    ).toBeCloseTo(exportRevenue(state), 6);
  });

  it('makes a dirtier grid unpopular and disasters likelier, and rewards a cleaner one', () => {
    const dirty = scalePlants(newGame(), 'coal', 1.5);
    expect(emissionsIndex(dirty)).toBeGreaterThan(1.4);
    expect(disasterFactor(dirty)).toBeGreaterThan(1.2);
    expect(governanceLines(dirty).find((l) => l.label === 'Air pollution')?.value).toBeLessThan(0);
    const clean = scalePlants(newGame(), 'coal', 0.5);
    expect(governanceLines(clean).find((l) => l.label === 'Air pollution')?.value).toBeGreaterThan(0);
    expect(disasterFactor(clean)).toBe(1);
  });
});

describe('power plant commands', () => {
  it('pay up front, connect after the build time and charge running costs to Industry & Infra', () => {
    let state = rich(newGame());
    const before = state.nation.treasury;
    state = run(state, { type: 'BUILD_PLANT', plant: 'gas', region: 'west', quantity: 4 });
    expect(state.nation.treasury).toBe(before - 4 * PLANT_CONTENT.gas.cost);
    expect(production(state)).toBe(production(newGame()));
    const done = calm(state, PLANT_CONTENT.gas.buildDays);
    expect(done.energy.queue).toHaveLength(0);
    expect(done.energy.plants.west.gas).toBe(state.energy.plants.west.gas + 4);
    expect(production(done)).toBeCloseTo(production(newGame()) + 4 * plantOutput('gas'), 10);
    expect(plantUpkeep(done).industry).toBeCloseTo(4 * PLANT_CONTENT.gas.upkeep, 10);
    for (const m of MINISTRIES) if (m !== 'industry') expect(plantUpkeep(done)[m]).toBe(0);
  });

  it('sizes an order to restore the margin, counting projects under way', () => {
    const later = rich(calm(newGame(), 365 * 2));
    const needed = plantsForMargin(later, 'solar');
    expect(needed).toBeGreaterThan(0);
    const ordered = run(later, {
      type: 'BUILD_PLANT',
      plant: 'solar',
      region: 'south',
      quantity: Math.min(needed, 200),
    });
    expect(plantsForMargin(ordered, 'solar')).toBe(Math.max(0, needed - 200));
  });

  it('refuses unaffordable orders, bad quantities and a full queue; cancelling refunds half', () => {
    const state = newGame();
    const poor = { ...state, nation: { ...state.nation, treasury: 100 } };
    expect(dispatch(poor, { type: 'BUILD_PLANT', plant: 'nuclear', region: 'south', quantity: 1 }).ok).toBe(false);
    for (const quantity of [0, -1, 1.5, 201]) {
      expect(dispatch(rich(state), { type: 'BUILD_PLANT', plant: 'solar', region: 'south', quantity }).ok).toBe(false);
    }
    let full = rich(state);
    for (let i = 0; i < MAX_PLANT_QUEUE; i++)
      full = run(full, { type: 'BUILD_PLANT', plant: 'solar', region: 'south', quantity: 1 });
    expect(dispatch(full, { type: 'BUILD_PLANT', plant: 'solar', region: 'south', quantity: 1 }).ok).toBe(false);
    const order = full.energy.queue[0]!;
    const cancelled = run(full, { type: 'CANCEL_PLANT', orderId: order.id });
    expect(cancelled.nation.treasury).toBe(full.nation.treasury + Math.round(order.cost / 2));
    expect(dispatch(cancelled, { type: 'CANCEL_PLANT', orderId: order.id }).ok).toBe(false);
  });

  it('decommissions plants to save their costs and emissions, never more than stand', () => {
    const state = newGame();
    const closed = run(state, { type: 'DECOMMISSION_PLANT', plant: 'coal', region: 'east', quantity: 10 });
    expect(closed.energy.plants.east.coal).toBe(state.energy.plants.east.coal - 10);
    expect(plantUpkeep(closed).industry).toBeLessThan(0);
    expect(emissionsIndex(closed)).toBeLessThan(1);
    expect(dispatch(state, { type: 'DECOMMISSION_PLANT', plant: 'nuclear', region: 'east', quantity: 1 }).ok).toBe(
      false,
    );
  });

  it('never mutate the state they are given', () => {
    const state = deepFreeze(rich(newGame()));
    const built = run(state, { type: 'BUILD_PLANT', plant: 'wind', region: 'south', quantity: 2 });
    deepFreeze(built);
    expect(() => calm(built, PLANT_CONTENT.wind.buildDays)).not.toThrow();
    expect(() =>
      run(state, { type: 'DECOMMISSION_PLANT', plant: 'hydro', region: 'north', quantity: 1 }),
    ).not.toThrow();
  });
});

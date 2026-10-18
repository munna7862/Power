import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  coverage,
  dispatch,
  FACILITY_CONTENT,
  facilitiesForTarget,
  facilityCount,
  fillLowest,
  hashState,
  homeRegion,
  hottestRegion,
  nationalCrime,
  nationalOfficers,
  nationalPoliceRatio,
  nationalStations,
  nationalUnrest,
  parseSave,
  placeName,
  REGION_LABELS,
  REGION_POPULATION_SHARE,
  REGIONS,
  splitFacilities,
  splitOfficers,
  type Command,
  type GameState,
  type RegionId,
} from '../../src/sim';
import { fillText } from '../../src/sim/events/engine';
import { deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

const rich = (state: GameState): GameState => ({ ...state, nation: { ...state.nation, treasury: 5_000_000 } });
const national = (overrides = {}) => rich(newGame({ options: { regions: false }, ...overrides }));
const perRegion = (f: (r: RegionId) => number) =>
  Object.fromEntries(REGIONS.map((r) => [r, f(r)])) as Record<RegionId, number>;
const total = (shares: { quantity: number }[]) => shares.reduce((s, x) => s + x.quantity, 0);

describe('the Regional play option', () => {
  it('is on by default, so a new game plays region by region as before', () => {
    expect(newGame().meta.options.regions).toBe(true);
    expect(newGame({ options: { regions: false } }).meta.options.regions).toBe(false);
  });

  it('keeps regional play for a v12 save, which was played region by region', () => {
    const result = parseSave(readFileSync(new URL('../fixtures/saves/v12.json', import.meta.url), 'utf8'));
    if (!result.ok) throw new Error(result.error);
    expect(result.save.state.meta.options.regions).toBe(true);
  });

  it('plays deterministically in national play', () => {
    const a = advanceDays(national({ seed: 7 }), 400);
    const b = advanceDays(national({ seed: 7 }), 400);
    expect(hashState(a)).toBe(hashState(b));
  });
});

describe('fillLowest (worst region first)', () => {
  const flat = perRegion(() => 1);

  it('fills the lowest level first and never hands out more than the quantity', () => {
    const level = { ...perRegion(() => 10), east: 0 };
    expect(fillLowest(level, flat, 5)).toEqual([{ region: 'east', quantity: 5 }]);
    const shares = fillLowest(level, flat, 16)!;
    expect(total(shares)).toBe(16);
    // East first catches up with the rest, then all six share the remaining six units.
    expect(shares.find((s) => s.region === 'east')?.quantity).toBe(11);
    for (const s of shares.filter((x) => x.region !== 'east')) expect(s.quantity).toBe(1);
  });

  it('breaks ties in REGIONS order, so the same order always lands in the same place', () => {
    const shares = fillLowest(
      perRegion(() => 0),
      flat,
      2,
    )!;
    expect(shares).toEqual([
      { region: REGIONS[0], quantity: 1 },
      { region: REGIONS[1], quantity: 1 },
    ]);
    expect(
      fillLowest(
        perRegion(() => 0),
        flat,
        2,
      ),
    ).toEqual(shares);
  });

  it('respects the caps, and refuses what the caps cannot hold', () => {
    const cap = { ...perRegion(() => 0), north: 3, south: 2 };
    const shares = fillLowest(
      perRegion(() => 0),
      flat,
      5,
      cap,
    )!;
    expect(shares).toEqual([
      { region: 'north', quantity: 3 },
      { region: 'south', quantity: 2 },
    ]);
    expect(
      fillLowest(
        perRegion(() => 0),
        flat,
        6,
        cap,
      ),
    ).toBeNull();
  });

  it('weights each region by how far one unit moves it', () => {
    // One unit raises the North by 1 and the South by 2: a big order gives the North twice as many.
    const step = { ...perRegion(() => 1000), north: 1, south: 2 };
    const shares = fillLowest({ ...perRegion(() => 100), north: 0, south: 0 }, step, 30)!;
    expect(shares).toEqual([
      { region: 'north', quantity: 20 },
      { region: 'south', quantity: 10 },
    ]);
  });
});

describe('national orders', () => {
  it('queues facilities for all of India, which open where coverage of their area is thinnest', () => {
    const state = deepFreeze(national());
    const area = FACILITY_CONTENT.clinic.area;
    const thinnest = REGIONS.reduce((a, b) => (coverage(state, b, area) < coverage(state, a, area) ? b : a));
    const ordered = run(state, { type: 'BUILD_FACILITY', facility: 'clinic', quantity: 300 });
    expect(ordered.infrastructure.queue.at(-1)).toMatchObject({ facility: 'clinic', region: null, quantity: 300 });
    expect(ordered.nation.treasury).toBe(state.nation.treasury - 300 * FACILITY_CONTENT.clinic.cost);

    const opened = advanceDays(ordered, FACILITY_CONTENT.clinic.buildDays);
    expect(facilityCount(opened, null, 'clinic') - facilityCount(state, null, 'clinic')).toBe(300);
    expect(opened.infrastructure.counts[thinnest].clinic).toBeGreaterThan(state.infrastructure.counts[thinnest].clinic);
  });

  it('accepts region-free orders in regional play too', () => {
    const state = rich(newGame());
    const next = run(state, { type: 'BUILD_FACILITY', facility: 'primarySchool', quantity: 10 });
    expect(next.infrastructure.queue.at(-1)?.region).toBeNull();
  });

  it('splits a national order by the same function the screens preview', () => {
    const state = national();
    expect(total(splitFacilities(state, 'clinic', 1234))).toBe(1234);
    expect(facilitiesForTarget(state, null, 'clinic')).toBe(
      REGIONS.reduce((s, r) => s + facilitiesForTarget(state, r, 'clinic'), 0),
    );
  });

  it('closes national demolitions where coverage is best, and refuses more than exist', () => {
    const state = national();
    const before = facilityCount(state, null, 'clinic');
    const next = run(state, { type: 'DEMOLISH_FACILITY', facility: 'clinic', quantity: 10 });
    expect(facilityCount(next, null, 'clinic')).toBe(before - 10);
    expect(dispatch(state, { type: 'DEMOLISH_FACILITY', facility: 'clinic', quantity: before + 1 }).ok).toBe(false);
  });

  it('recruits where the force per head is thinnest, and dismisses where it is thickest', () => {
    const state = national();
    const thin = { ...state, police: { ...state.police, officers: { ...state.police.officers, east: 1000 } } };
    const recruited = run(thin, { type: 'RECRUIT_POLICE', officers: 5000 });
    expect(recruited.police.officers.east).toBe(6000);
    expect(nationalOfficers(recruited)).toBe(nationalOfficers(thin) + 5000);

    const dismissed = run(thin, { type: 'RECRUIT_POLICE', officers: -5000 });
    expect(dismissed.police.officers.east).toBe(1000);
    expect(nationalOfficers(dismissed)).toBe(nationalOfficers(thin) - 5000);
    expect(splitOfficers(thin, -(nationalOfficers(thin) + 1))).toBeNull();
  });

  it('builds national stations where the most officers have none', () => {
    const state = national();
    const crowded = { ...state, police: { ...state.police, stations: { ...state.police.stations, south: 0 } } };
    const next = run(crowded, { type: 'BUILD_STATION', quantity: 3 });
    expect(next.police.stations.south).toBe(3);
    expect(nationalStations(next)).toBe(nationalStations(crowded) + 3);
  });

  it('sites national power plants and factories in the home region, and closes them where there are most', () => {
    const state = national();
    const built = run(state, { type: 'BUILD_PLANT', plant: 'solar', quantity: 2 });
    expect(built.energy.queue.at(-1)?.region).toBe(homeRegion());
    expect(REGION_POPULATION_SHARE[homeRegion()]).toBe(Math.max(...Object.values(REGION_POPULATION_SHARE)));

    const most = REGIONS.reduce((a, b) => (state.energy.plants[b].coal > state.energy.plants[a].coal ? b : a));
    const closed = run(state, { type: 'DECOMMISSION_PLANT', plant: 'coal', quantity: 1 });
    expect(closed.energy.plants[most].coal).toBe(state.energy.plants[most].coal - 1);
  });
});

describe('national play speaks only of India', () => {
  it('names India, never a region, in the inbox', () => {
    const state = national();
    const next = run(run(state, { type: 'RECRUIT_POLICE', region: 'east', officers: 100 }), {
      type: 'BUILD_FACILITY',
      facility: 'clinic',
      region: 'south',
      quantity: 5,
    });
    const titles = next.log.slice(-2).map((e) => e.title);
    expect(titles).toEqual(['Police recruited in India', 'Construction begins in India']);
    for (const label of Object.values(REGION_LABELS)) {
      expect(next.log.slice(-2).some((e) => e.title.includes(label) || e.body.includes(label))).toBe(false);
    }
    expect(placeName(newGame(), 'east')).toBe('the East');
  });

  it('fills event text with the affected area instead of a region', () => {
    expect(fillText(national(), 'Floods in the {region}. The {region} needs help.', 'east', null)).toBe(
      'Floods in the affected area. The affected area needs help.',
    );
    expect(fillText(newGame(), 'Floods in the {region}. The {region} needs help.', 'east', null)).toBe(
      'Floods in the East. The East needs help.',
    );
    expect(fillText(newGame(), 'Calm returns to the {region}.', null, null)).toBe('Calm returns to the country.');
  });
});

describe('national figures', () => {
  it('reads unrest from the hottest region and crime by population', () => {
    const state = newGame();
    const hot = { ...state, security: { ...state.security, unrest: { ...state.security.unrest, west: 77 } } };
    expect(hottestRegion(hot)).toBe('west');
    expect(nationalUnrest(hot)).toBe(77);
    expect(nationalCrime(state)).toBeCloseTo(
      REGIONS.reduce((s, r) => s + REGION_POPULATION_SHARE[r] * state.security.crime[r], 0),
    );
  });

  it('starts with the opening police strength', () => {
    expect(nationalPoliceRatio(newGame())).toBeCloseTo(1, 6);
  });
});

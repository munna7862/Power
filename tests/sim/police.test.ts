import { describe, expect, it } from 'vitest';
import {
  AGENCIES,
  AGENCY_CONTENT,
  allEfficiencies,
  approvalTarget,
  civilLibertiesCost,
  computeSatisfaction,
  crimeTarget,
  dispatch,
  exposureChance,
  intelligenceFoilChance,
  MINISTRIES,
  OFFICER_CONTENT,
  officersForRatio,
  plotSuccessChance,
  POLICE_UNIT_CONTENT,
  POLICE_UNITS,
  policeRatio,
  policeUpkeep,
  presidentialSafety,
  projectMonth,
  REGIONS,
  START_CRIME,
  STATION_CONTENT,
  stationsNeeded,
  terrorTarget,
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

/** Every region's police scaled by a factor, with the stations to house them. */
function scalePolice(state: GameState, factor: number): GameState {
  const officers = Object.fromEntries(REGIONS.map((r) => [r, Math.round(state.police.officers[r] * factor)]));
  const stations = Object.fromEntries(
    REGIONS.map((r) => [r, Math.ceil((officers[r]! * 1.05) / STATION_CONTENT.capacity)]),
  );
  return {
    ...state,
    police: {
      ...state.police,
      officers: officers as GameState['police']['officers'],
      stations: stations as GameState['police']['stations'],
    },
  };
}

const driver = (drivers: { label: string; value: number }[], label: string) =>
  drivers.find((d) => d.label === label)?.value ?? NaN;

describe('police at the start of a game', () => {
  it('change nothing: every police effect and all extra upkeep are zero', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    for (const r of REGIONS) {
      expect(policeRatio(state, r)).toBeCloseTo(1, 12);
      expect(crimeTarget(state, r).total).toBeCloseTo(START_CRIME[r], 10);
      const drivers = unrestTarget(state, r, eff).drivers;
      expect(Math.abs(driver(drivers, 'Police on the street'))).toBeLessThan(1e-12);
      expect(Math.abs(driver(drivers, 'Crime'))).toBe(0);
      expect(stationsNeeded(state.police, r)).toBe(0);
    }
    for (const label of ['Counter-terror squads', 'Intelligence service', 'Border police']) {
      expect(Math.abs(driver(terrorTarget(state, eff).drivers, label))).toBe(0);
    }
    expect(civilLibertiesCost(state)).toBe(0);
    expect(Object.values(policeUpkeep(state)).every((v) => v === 0)).toBe(true);
    expect(approvalTarget(state, state.politics.satisfaction).breakdown.some((l) => l.source === 'police')).toBe(false);
  });

  it('start at about 150 officers per 100,000 people, all housed in stations', () => {
    const state = newGame();
    const total = REGIONS.reduce((s, r) => s + state.police.officers[r], 0);
    expect((total / state.nation.population) * 1e5).toBeCloseTo(OFFICER_CONTENT.openingPer100k, 0);
    for (const u of POLICE_UNITS) expect(state.police.units[u]).toBe(POLICE_UNIT_CONTENT[u].opening);
    for (const a of AGENCIES) expect(state.police.agencies[a]).toBe(50);
  });
});

describe('police effects', () => {
  it('thin out as the population grows and nobody is recruited', () => {
    const later = calm(newGame(), 365);
    expect(policeRatio(later, 'north')).toBeLessThan(1);
    expect(officersForRatio(later, 'north')).toBeGreaterThan(0);
  });

  it('cut crime and unrest, with diminishing returns, and cost civil liberties faster than they help', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    const more = scalePolice(state, 1.2);
    const double = scalePolice(state, 2);
    const crime = (s: GameState) => crimeTarget(s, 'east').total;
    const unrest = (s: GameState) => driver(unrestTarget(s, 'east', eff).drivers, 'Police on the street');
    expect(crime(more)).toBeLessThan(crime(state));
    expect(unrest(more)).toBeLessThan(0);
    // Each extra officer helps less than the one before.
    expect(crime(state) - crime(more)).toBeGreaterThan((crime(more) - crime(double)) * (0.2 / 0.8));
    // …while the civil-liberties cost grows faster than linearly.
    expect(civilLibertiesCost(more)).toBeGreaterThan(0);
    expect(civilLibertiesCost(double)).toBeGreaterThan(5 * civilLibertiesCost(more));
    const line = approvalTarget(double, state.politics.satisfaction).breakdown.find((l) => l.source === 'police');
    expect(line?.value).toBeCloseTo(-civilLibertiesCost(double), 10);
    expect(approvalTarget(double, state.politics.satisfaction).total).toBeLessThan(
      approvalTarget(state, state.politics.satisfaction).total,
    );
  });

  it('let crime rise with joblessness and hurt the sense of safety', () => {
    const state = newGame();
    const jobless = { ...state, economy: { ...state.economy, unemployment: 0.12 } };
    expect(crimeTarget(jobless, 'west').total).toBeGreaterThan(crimeTarget(state, 'west').total + 5);
    const crime = Object.fromEntries(REGIONS.map((r) => [r, 70])) as GameState['security']['crime'];
    const lawless = { ...state, security: { ...state.security, crime } };
    const eff = allEfficiencies(state);
    expect(computeSatisfaction(lawless, eff).safety).toBeLessThan(computeSatisfaction(state, eff).safety - 10);
    expect(driver(unrestTarget(lawless, 'west', eff).drivers, 'Crime')).toBeGreaterThan(5);
  });

  it('let the agencies foil plots, cut the threat, guard the President and find corruption', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    const strong = {
      ...state,
      police: {
        ...state.police,
        agencies: { intelligenceService: 90, antiCorruptionBureau: 90, borderPolice: 90, presidentialProtection: 90 },
        units: { ...state.police.units, counterTerror: 80 },
      },
    };
    expect(intelligenceFoilChance(strong, eff)).toBeGreaterThan(intelligenceFoilChance(state, eff));
    expect(terrorTarget(strong, eff).total).toBeLessThan(terrorTarget(state, eff).total);
    expect(plotSuccessChance(strong, 0, eff)).toBeLessThan(plotSuccessChance(state, 0, eff));
    expect(presidentialSafety(strong, eff)).toBeGreaterThan(presidentialSafety(state, eff));
    expect(exposureChance(strong, eff.antiCorruption)).toBeGreaterThan(exposureChance(state, eff.antiCorruption));
  });
});

describe('police commands', () => {
  it('recruit officers for a fee and charge their pay to Home Affairs every month', () => {
    let state = rich(newGame());
    const before = state.nation.treasury;
    state = run(state, { type: 'RECRUIT_POLICE', region: 'east', officers: 40_000 });
    expect(state.nation.treasury).toBe(before - 40_000 * OFFICER_CONTENT.recruitCost);
    expect(policeUpkeep(state).home).toBeCloseTo(40_000 * OFFICER_CONTENT.upkeep, 8);
    const without = { ...state, police: newGame().police };
    expect(
      projectMonth(state, state.budget).expenditure.home - projectMonth(without, state.budget).expenditure.home,
    ).toBeCloseTo(policeUpkeep(state).home, 6);
    // The opening stations have 5% spare room; beyond it, officers need new stations or work at half strength.
    expect(stationsNeeded(state.police, 'east')).toBeGreaterThan(0);
    const housed = run(state, {
      type: 'BUILD_STATION',
      region: 'east',
      quantity: stationsNeeded(state.police, 'east'),
    });
    expect(policeRatio(housed, 'east')).toBeGreaterThan(policeRatio(state, 'east'));
  });

  it('dismiss officers for free, never more than serve', () => {
    const state = newGame();
    const cut = run(state, { type: 'RECRUIT_POLICE', region: 'south', officers: -1000 });
    expect(cut.nation.treasury).toBe(state.nation.treasury);
    expect(policeUpkeep(cut).home).toBeLessThan(0);
    expect(dispatch(state, { type: 'RECRUIT_POLICE', region: 'south', officers: -10_000_000 }).ok).toBe(false);
    expect(dispatch(state, { type: 'RECRUIT_POLICE', region: 'south', officers: 0 }).ok).toBe(false);
    expect(dispatch(state, { type: 'RECRUIT_POLICE', region: 'south', officers: 2.5 }).ok).toBe(false);
  });

  it('upgrade equipment tier by tier, making every officer more effective', () => {
    let state = rich(newGame());
    state = run(state, { type: 'UPGRADE_POLICE_EQUIPMENT' });
    expect(state.police.equipment).toBe(2);
    expect(policeRatio(state, 'west')).toBeCloseTo(1.1, 10);
    state = run(state, { type: 'UPGRADE_POLICE_EQUIPMENT' });
    expect(state.police.equipment).toBe(3);
    expect(dispatch(state, { type: 'UPGRADE_POLICE_EQUIPMENT' }).ok).toBe(false);
    // Better kit is not more police: civil liberties are untouched.
    expect(civilLibertiesCost(state)).toBe(0);
    const poor = { ...newGame(), nation: { ...newGame().nation, treasury: 10 } };
    expect(dispatch(poor, { type: 'UPGRADE_POLICE_EQUIPMENT' }).ok).toBe(false);
  });

  it('raise and disband special units', () => {
    let state = rich(newGame());
    state = run(state, { type: 'RAISE_UNIT', unit: 'counterTerror', quantity: 10 });
    expect(state.police.units.counterTerror).toBe(50);
    expect(policeUpkeep(state).home).toBeCloseTo(10 * POLICE_UNIT_CONTENT.counterTerror.upkeep, 8);
    state = run(state, { type: 'RAISE_UNIT', unit: 'cyberCell', quantity: -60 });
    expect(state.police.units.cyberCell).toBe(0);
    expect(dispatch(state, { type: 'RAISE_UNIT', unit: 'cyberCell', quantity: -1 }).ok).toBe(false);
  });

  it('fund agencies up for a price and down for free, charging the right department', () => {
    let state = rich(newGame());
    const before = state.nation.treasury;
    state = run(state, { type: 'FUND_AGENCY', agency: 'intelligenceService', strength: 70 });
    expect(state.nation.treasury).toBe(before - 20 * AGENCY_CONTENT.intelligenceService.costPerPoint);
    expect(policeUpkeep(state).intelligence).toBeCloseTo(20 * AGENCY_CONTENT.intelligenceService.upkeepPerPoint, 8);
    state = run(state, { type: 'FUND_AGENCY', agency: 'antiCorruptionBureau', strength: 30 });
    expect(policeUpkeep(state).antiCorruption).toBeLessThan(0);
    for (const m of MINISTRIES)
      if (!['intelligence', 'antiCorruption'].includes(m)) expect(policeUpkeep(state)[m]).toBe(0);
    for (const strength of [101, -1, 50.5, 30]) {
      expect(dispatch(state, { type: 'FUND_AGENCY', agency: 'antiCorruptionBureau', strength }).ok).toBe(false);
    }
  });

  it('never mutate the state they are given, and crime drifts monthly', () => {
    const state = deepFreeze(rich(newGame()));
    for (const command of [
      { type: 'RECRUIT_POLICE', region: 'north', officers: 100 },
      { type: 'BUILD_STATION', region: 'north', quantity: 2 },
      { type: 'UPGRADE_POLICE_EQUIPMENT' },
      { type: 'RAISE_UNIT', unit: 'armedPolice', quantity: 3 },
      { type: 'FUND_AGENCY', agency: 'borderPolice', strength: 60 },
    ] as const) {
      expect(() => run(state, command)).not.toThrow();
    }
    const jobless = deepFreeze({ ...state, economy: { ...state.economy, unemployment: 0.14 } });
    // Crime closes a tenth of the gap to its target each month.
    expect(calm(jobless, 62).security.crime.east).toBeGreaterThan(START_CRIME.east + 1.5);
  });
});

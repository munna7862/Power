import { PLANT_CONTENT } from '../content/power';
import { MINISTRIES, PLANTS, REGIONS, type MinistryId, type PlantId, type RegionId } from '../content/ids';
import { SECTOR_START_SHARE, START_GDP, START_POPULATION } from '../economy/constants';
import { coverageIndex, openingInfrastructure } from '../infrastructure/coverage';
import type { EnergyState, GameState } from '../state/types';
import {
  DEMAND_ELASTICITY,
  DEMAND_SHARES,
  EXPORT_MARGIN,
  EXPORT_PRICE,
  MIN_EXPORT_GW,
  OPENING_MARGIN,
  POLLUTION_APPROVAL,
  POLLUTION_DISASTERS,
  SHORTFALL_APPROVAL,
  SHORTFALL_GROWTH,
  type DemandSource,
} from './constants';

/**
 * Grid formulas shared by the monthly systems, the Energy screen and the bots, so the "Why?" tooltips can never
 * drift from what the sim does. The grid is national: plants in every region feed one demand. A new game opens
 * with a 5% reserve margin, no shortfall, no exports and the opening emissions, so tick 0 plays as before Sprint
 * 8.4; after that, a growing economy needs more power every year.
 */

type Plants = EnergyState['plants'];

/** The power plants standing at the start of every game (content/power.json). */
export function openingEnergy(): EnergyState {
  return {
    plants: Object.fromEntries(
      REGIONS.map((r) => [r, Object.fromEntries(PLANTS.map((p) => [p, PLANT_CONTENT[p].opening[r]]))]),
    ) as Plants,
    queue: [],
  };
}

const OPENING = openingEnergy();

/** Average output of one plant, GW: capacity × the share of the time it generates. */
export const plantOutput = (plant: PlantId): number =>
  PLANT_CONTENT[plant].capacity * PLANT_CONTENT[plant].capacityFactor;

const fleet = (plants: Plants, plant: PlantId): number => REGIONS.reduce((s, r) => s + plants[r][plant], 0);

function productionOf(plants: Plants): number {
  return PLANTS.reduce((s, p) => s + fleet(plants, p) * plantOutput(p), 0);
}

function emissionsOf(plants: Plants): number {
  return PLANTS.reduce((s, p) => s + fleet(plants, p) * plantOutput(p) * PLANT_CONTENT[p].emissions, 0);
}

const OPENING_PRODUCTION = productionOf(OPENING.plants);
const OPENING_EMISSIONS = emissionsOf(OPENING.plants);
/** Demand at the start, GW: the opening fleet less its reserve margin. */
const OPENING_DEMAND = OPENING_PRODUCTION / (1 + OPENING_MARGIN);

/** Average output of the whole grid, GW. */
export const production = (state: Pick<GameState, 'energy'>): number => productionOf(state.energy.plants);

/** Average output by plant type, GW. */
export const productionBy = (state: Pick<GameState, 'energy'>, plant: PlantId): number =>
  fleet(state.energy.plants, plant) * plantOutput(plant);

export const plantsOf = (state: Pick<GameState, 'energy'>, plant: PlantId): number => fleet(state.energy.plants, plant);

const START_INDUSTRY = START_GDP * (SECTOR_START_SHARE.industry + SECTOR_START_SHARE.energy);
const START_SERVICES = START_GDP * (SECTOR_START_SHARE.services + SECTOR_START_SHARE.tech);
const START_GDP_PER_HEAD = START_GDP / START_POPULATION;
const OPENING_PUBLIC_INDEX = coverageIndex(
  {
    infrastructure: openingInfrastructure(),
    nation: { name: '', treasury: 0, approval: 0, population: START_POPULATION },
  },
  'services',
);

type DemandInputs = Pick<GameState, 'economy' | 'nation' | 'infrastructure'>;

/** Demand by source, GW. Each source starts at its share of opening demand and follows its driver. */
export function demand(state: DemandInputs): Record<DemandSource, number> {
  const { sectors } = state.economy;
  const population = state.nation.population;
  const gdp = Object.values(sectors).reduce((s, x) => s + x.output, 0);
  const industry = (sectors.industry.output + sectors.energy.output) / START_INDUSTRY;
  const services = (sectors.services.output + sectors.tech.output) / START_SERVICES;
  const income = gdp / population / START_GDP_PER_HEAD;
  return {
    homes:
      OPENING_DEMAND * DEMAND_SHARES.homes * (population / START_POPULATION) * income ** DEMAND_ELASTICITY.homesIncome,
    industry: OPENING_DEMAND * DEMAND_SHARES.industry * industry ** DEMAND_ELASTICITY.industry,
    services: OPENING_DEMAND * DEMAND_SHARES.services * services ** DEMAND_ELASTICITY.services,
    public: OPENING_DEMAND * DEMAND_SHARES.public * (coverageIndex(state, 'services') / OPENING_PUBLIC_INDEX),
  };
}

export const consumption = (state: DemandInputs): number => Object.values(demand(state)).reduce((a, b) => a + b, 0);

type GridInputs = DemandInputs & Pick<GameState, 'energy'>;

/** Production − demand, GW (negative = shortfall). */
export const powerBalance = (state: GridInputs): number => production(state) - consumption(state);

/** Share of demand the grid cannot meet, 0–1. */
export function shortfall(state: GridInputs): number {
  const need = consumption(state);
  return need <= 0 ? 0 : Math.max(0, 1 - production(state) / need);
}

/** GW sold to neighbours: production beyond demand and the reserve margin. */
export function exportedPower(state: GridInputs): number {
  const surplus = production(state) - consumption(state) * (1 + EXPORT_MARGIN);
  return surplus > MIN_EXPORT_GW ? surplus : 0;
}

/** ₹ crore a month from power exports, counted with non-tax revenue. */
export const exportRevenue = (state: GridInputs): number => exportedPower(state) * EXPORT_PRICE;

/** Emissions against the opening grid (1 = the same as at the start). */
export const emissionsIndex = (state: Pick<GameState, 'energy'>): number =>
  emissionsOf(state.energy.plants) / OPENING_EMISSIONS;

/** Growth lost in every sector to power cuts (annual rate; 0 without a shortfall). */
export const shortfallGrowth = (state: GridInputs): number => SHORTFALL_GROWTH * shortfall(state);

/** Approval-target lines from the grid: power cuts and air pollution (each 0 at the start). */
export function gridApprovalLines(state: GridInputs): { label: string; value: number }[] {
  return [
    { label: 'Power cuts', value: SHORTFALL_APPROVAL * shortfall(state) },
    { label: 'Air pollution', value: POLLUTION_APPROVAL * (emissionsIndex(state) - 1) },
  ];
}

/** How much likelier disaster events are than at the start, from emissions above the opening grid (1 = unchanged). */
export const disasterFactor = (state: Pick<GameState, 'energy'>): number =>
  1 + POLLUTION_DISASTERS * Math.max(0, emissionsIndex(state) - 1);

/**
 * Monthly running and fuel costs of plants beyond the opening fleet, ₹ crore, charged to Industry & Infrastructure.
 * The opening fleet's costs are part of that department's allocation; decommissioning below it saves money.
 */
export function plantUpkeep(state: Pick<GameState, 'energy'>): Record<MinistryId, number> {
  const upkeep = Object.fromEntries(MINISTRIES.map((m) => [m, 0])) as Record<MinistryId, number>;
  for (const r of REGIONS) {
    for (const p of PLANTS) {
      const c = PLANT_CONTENT[p];
      upkeep.industry += (state.energy.plants[r][p] - OPENING.plants[r][p]) * (c.upkeep + c.fuelCost);
    }
  }
  return upkeep;
}

/** Plants of one type needed to bring the grid to the given margin over demand, counting projects under way. */
export function plantsForMargin(state: GridInputs, plant: PlantId, margin = OPENING_MARGIN): number {
  const queued = state.energy.queue.reduce((s, o) => s + o.quantity * plantOutput(o.plant), 0);
  const gap = consumption(state) * (1 + margin) - production(state) - queued;
  return gap <= 0 ? 0 : Math.ceil(gap / plantOutput(plant));
}

export const plantsInRegion = (state: Pick<GameState, 'energy'>, region: RegionId, plant: PlantId): number =>
  state.energy.plants[region][plant];

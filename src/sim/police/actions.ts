import {
  AGENCY_CONTENT,
  EQUIPMENT_CONTENT,
  OFFICER_CONTENT,
  POLICE_UNIT_CONTENT,
  STATION_CONTENT,
} from '../content/police';
import {
  AGENCIES,
  POLICE_UNITS,
  REGION_LABELS,
  REGIONS,
  type AgencyId,
  type PoliceUnitId,
  type RegionId,
} from '../content/ids';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { EquipmentTier, GameState, PoliceState } from '../state/types';
import { MAX_RECRUIT, MAX_STATIONS, MAX_UNIT_ORDER } from './constants';

/**
 * The President's police decisions. Each one is a pure state change behind a validator, called from dispatch().
 * Growing the force is paid up front from the treasury; shrinking it is free and saves its upkeep.
 */

const whole = (n: number) => Number.isInteger(n);

const withPolice = (state: GameState, police: PoliceState, cost: number): GameState => ({
  ...state,
  police,
  nation: { ...state.nation, treasury: state.nation.treasury - cost },
});

const afford = (state: GameState, cost: number): string | null =>
  state.nation.treasury < cost ? 'The treasury cannot cover this.' : null;

/** ₹ crore to recruit officers (dismissals are free). */
export const recruitCost = (officers: number): number => Math.max(0, officers) * OFFICER_CONTENT.recruitCost;

/** Why officers cannot be recruited (positive) or dismissed (negative) in a region, or null. */
export function validateRecruit(state: GameState, region: RegionId, officers: number): string | null {
  if (!REGIONS.includes(region)) return `Unknown region ${region}.`;
  if (!whole(officers) || officers === 0) return 'Choose a whole number of officers.';
  if (Math.abs(officers) > MAX_RECRUIT) return `At most ${groupIndian(MAX_RECRUIT)} officers at a time.`;
  if (state.police.officers[region] + officers < 0) return 'There are not that many officers to dismiss.';
  return afford(state, recruitCost(officers));
}

export function recruit(state: GameState, region: RegionId, officers: number): GameState {
  const police = {
    ...state.police,
    officers: { ...state.police.officers, [region]: state.police.officers[region] + officers },
  };
  const cost = recruitCost(officers);
  const place = REGION_LABELS[region];
  return appendLog(withPolice(state, police, cost), {
    severity: officers > 0 ? 'info' : 'warning',
    category: 'security',
    title: officers > 0 ? `Police recruited in the ${place}` : `Police cut in the ${place}`,
    body:
      officers > 0
        ? `${groupIndian(officers)} officers join the force for ₹${groupIndian(cost)} crore in training. Their pay comes out of the Home Affairs budget.`
        : `${groupIndian(-officers)} officers leave the force. Their pay is saved, and the streets are thinner on police.`,
  });
}

export const stationCost = (quantity: number): number => quantity * STATION_CONTENT.cost;

export function validateStations(state: GameState, region: RegionId, quantity: number): string | null {
  if (!REGIONS.includes(region)) return `Unknown region ${region}.`;
  if (!whole(quantity) || quantity < 1) return 'Choose a whole number of stations, at least one.';
  if (quantity > MAX_STATIONS) return `At most ${groupIndian(MAX_STATIONS)} stations at a time.`;
  return afford(state, stationCost(quantity));
}

export function buildStations(state: GameState, region: RegionId, quantity: number): GameState {
  const police = {
    ...state.police,
    stations: { ...state.police.stations, [region]: state.police.stations[region] + quantity },
  };
  return appendLog(withPolice(state, police, stationCost(quantity)), {
    severity: 'info',
    category: 'security',
    title: `New police stations in the ${REGION_LABELS[region]}`,
    body: `${groupIndian(quantity)} stations open, with room for ${groupIndian(quantity * STATION_CONTENT.capacity)} more officers.`,
  });
}

/** The next equipment tier and its price, or null at the top tier. */
export const nextEquipment = (police: PoliceState) => EQUIPMENT_CONTENT[police.equipment] ?? null;

export function validateEquipment(state: GameState): string | null {
  const next = nextEquipment(state.police);
  if (!next) return 'The police already have the best equipment.';
  return afford(state, next.cost);
}

export function upgradeEquipment(state: GameState): GameState {
  const next = nextEquipment(state.police);
  if (!next) return state;
  return appendLog(withPolice(state, { ...state.police, equipment: next.tier as EquipmentTier }, next.cost), {
    severity: 'good',
    category: 'security',
    title: `Police equipment: ${next.name}`,
    body: `${next.summary} Every officer is now ${Math.round((next.effect - 1) * 100)}% more effective than with the basic kit.`,
  });
}

export const unitCost = (unit: PoliceUnitId, quantity: number): number =>
  Math.max(0, quantity) * POLICE_UNIT_CONTENT[unit].cost;

/** Why a unit cannot be raised (positive) or disbanded (negative), or null. */
export function validateUnit(state: GameState, unit: PoliceUnitId, quantity: number): string | null {
  if (!POLICE_UNITS.includes(unit)) return `Unknown police unit ${unit}.`;
  if (!whole(quantity) || quantity === 0) return 'Choose a whole number of units.';
  if (Math.abs(quantity) > MAX_UNIT_ORDER) return `At most ${MAX_UNIT_ORDER} units at a time.`;
  if (state.police.units[unit] + quantity < 0) return 'There are not that many to disband.';
  return afford(state, unitCost(unit, quantity));
}

export function changeUnits(state: GameState, unit: PoliceUnitId, quantity: number): GameState {
  const police = { ...state.police, units: { ...state.police.units, [unit]: state.police.units[unit] + quantity } };
  const name = POLICE_UNIT_CONTENT[unit].name.toLowerCase();
  return appendLog(withPolice(state, police, unitCost(unit, quantity)), {
    severity: quantity > 0 ? 'info' : 'warning',
    category: 'security',
    title: quantity > 0 ? 'Police units raised' : 'Police units disbanded',
    body:
      quantity > 0
        ? `${quantity} × ${name} raised for ₹${groupIndian(unitCost(unit, quantity))} crore.`
        : `${-quantity} × ${name} disbanded to save their upkeep.`,
  });
}

/** ₹ crore to take an agency to a new strength (cuts are free). */
export const agencyCost = (state: Pick<GameState, 'police'>, agency: AgencyId, strength: number): number =>
  Math.max(0, strength - state.police.agencies[agency]) * AGENCY_CONTENT[agency].costPerPoint;

export function validateAgency(state: GameState, agency: AgencyId, strength: number): string | null {
  if (!AGENCIES.includes(agency)) return `Unknown agency ${agency}.`;
  if (!whole(strength) || strength < 0 || strength > 100) return 'Strength runs from 0 to 100.';
  if (strength === state.police.agencies[agency]) return 'The agency is already at that strength.';
  return afford(state, agencyCost(state, agency, strength));
}

export function fundAgency(state: GameState, agency: AgencyId, strength: number): GameState {
  const before = state.police.agencies[agency];
  const cost = agencyCost(state, agency, strength);
  const police = { ...state.police, agencies: { ...state.police.agencies, [agency]: strength } };
  const name = AGENCY_CONTENT[agency].name;
  return appendLog(withPolice(state, police, cost), {
    severity: strength > before ? 'info' : 'warning',
    category: 'security',
    title: `${name}: strength ${strength}`,
    body:
      strength > before
        ? `The ${name.toLowerCase()} grows from ${before} to ${strength} for ₹${groupIndian(cost)} crore; its running costs rise with it.`
        : `The ${name.toLowerCase()} is cut from ${before} to ${strength}. Its running costs fall.`,
  });
}

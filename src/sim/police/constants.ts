import type { RegionId } from '../content/ids';

/** Crime each region starts at (and heads toward while nothing changes). Regional, never communal. */
export const START_CRIME: Record<RegionId, number> = {
  north: 38,
  south: 32,
  east: 39,
  west: 34,
  central: 37,
  northEast: 35,
};

/** Every agency's strength at the start, 0–100. Upkeep is charged only above it. */
export const OPENING_AGENCY_STRENGTH = 50;
/** Opening stations house this many times the opening officers, so the opening force is fully deployed. */
export const STATION_HEADROOM = 1.05;
/** Officers beyond their stations' capacity work at this share of their strength. */
export const UNHOUSED_EFFECT = 0.5;
/** Police ratios below this count as this, so a disbanded force has a large but finite effect. */
export const RATIO_FLOOR = 0.25;

/** Share of the gap to its target that crime closes each month. */
export const CRIME_DRIFT = 0.1;

/**
 * How strongly the police move each outcome. Ratios compare today's force with the opening one and enter as
 * natural logs (diminishing returns): doubling the police (ln 2 ≈ 0.69) takes about 12 points off crime.
 */
export const POLICE_IMPACT = {
  crime: { unemployment: 200, corruption: 0.25, police: -18, armedPolice: -4, cyberCell: -5 },
  unrest: { police: -12, rapidResponse: -4, armedPolice: -2, crime: 0.2 },
  /** "Safety and order" satisfaction points per point of average crime above the start. */
  safety: -0.5,
  terror: { counterTerror: -8, intelligenceService: -0.12, borderPolice: -0.1 },
  /** Added to the chance intelligence uncovers a forming plot, per agency point above the opening strength. */
  foilPerPoint: 0.004,
  /** Added to a live plot's chance of success per unit of ln(counter-terror squads ÷ opening). */
  plotSuccess: -0.08,
  /** Presidential safety points per protection point above the opening strength. */
  protectionPerPoint: 0.2,
  /** National corruption target points per bureau point above the opening strength. */
  corruptionPerPoint: -0.12,
  /** Added to an audit's chance of finding misuse per bureau point above the opening strength. */
  exposurePerPoint: 0.004,
};

/**
 * Civil liberties: approval points lost to over-policing, weight × (ratio − 1)^1.5 for officers per head and armed
 * battalions above the opening force. The cost grows faster than the benefit, so maximum policing is never free:
 * 20% more officers everywhere costs about 2.7 points; 50% more about 10.6.
 */
export const CIVIL_LIBERTIES = { officers: 30, armedPolice: 10, exponent: 1.5 };

/** Largest change in one order. */
export const MAX_RECRUIT = 500_000;
export const MAX_STATIONS = 10_000;
export const MAX_UNIT_ORDER = 500;

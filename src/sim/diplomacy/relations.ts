import { COUNTRY_CONTENT } from '../content/world';
import type { CountryId, RelationDriver, TreatyType } from '../content/ids';
import { militaryStrength } from '../military/strength';
import type { CountryState, GameState, Treaty } from '../state/types';
import { INDIA } from '../state/types';
import { ideologyMatch, NEUTRAL_REPUTATION, RELATION_WEIGHTS } from './constants';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const countryState = (state: Pick<GameState, 'diplomacy'>, id: CountryId): CountryState => {
  const found = state.diplomacy.countries[id];
  if (!found) throw new Error(`Unknown country ${id}`);
  return found;
};

export function patchCountry(state: GameState, id: CountryId, patch: Partial<CountryState>): GameState {
  const current = countryState(state, id);
  return {
    ...state,
    diplomacy: {
      ...state.diplomacy,
      countries: { ...state.diplomacy.countries, [id]: { ...current, ...patch } },
    },
  };
}

export const relationOf = (state: Pick<GameState, 'diplomacy'>, id: CountryId): number =>
  countryState(state, id).relation;

/** Moves a country’s relation with India by `delta`, within −100…+100. */
export function adjustRelation(state: GameState, id: CountryId, delta: number): GameState {
  const current = countryState(state, id);
  return patchCountry(state, id, { relation: clamp(current.relation + delta, -100, 100) });
}

/** Records friction (an exposed spy, a threat, a broken deal). It sours the relation target until it fades. */
export function addIncident(state: GameState, id: CountryId, amount: number): GameState {
  const current = countryState(state, id);
  return patchCountry(state, id, { incidents: clamp(current.incidents + amount, 0, 100) });
}

/** India’s weight in world affairs on the same 0–100 scale as the countries’ `power` (75 at the start). */
export function indiaPower(state: Pick<GameState, 'military'>): number {
  return clamp(75 * Math.sqrt(militaryStrength(state.military) / 80), 30, 100);
}

/** Active measures and treaties that involve India and the country. */
export function treatiesWith(state: Pick<GameState, 'diplomacy'>, id: CountryId, type?: TreatyType): Treaty[] {
  return state.diplomacy.treaties.filter((t) => t.parties.includes(id) && (type === undefined || t.type === type));
}

export const hasTreaty = (state: Pick<GameState, 'diplomacy'>, id: CountryId, type: TreatyType): boolean =>
  treatiesWith(state, id, type).length > 0;

/** True while the country sanctions India (a sanctions treaty with the country as imposer). */
export const sanctionsIndia = (state: Pick<GameState, 'diplomacy'>, id: CountryId): boolean =>
  state.diplomacy.treaties.some((t) => t.type === 'sanctions' && t.parties[0] === id && t.parties[1] === INDIA);

export const atWarWithCountry = (state: Pick<GameState, 'military'>, id: CountryId): boolean =>
  state.military.wars.some((w) => w.rival === id);

export interface RelationLine {
  driver: RelationDriver;
  value: number;
}

/**
 * Why a country feels the way it does: the terms that add up to where its relation is heading. Shared by the
 * monthly drift and the Country panel’s “Why?” tooltip, so the two can never disagree.
 */
export function relationDrivers(state: GameState, id: CountryId): RelationLine[] {
  const content = COUNTRY_CONTENT[id];
  if (!content) throw new Error(`Unknown country ${id}`);
  const c = countryState(state, id);
  const w = RELATION_WEIGHTS;
  const trades = treatiesWith(state, id, 'trade').length;
  return [
    { driver: 'base', value: content.relation },
    { driver: 'ideology', value: w.ideology * ideologyMatch(content.outlook, state.politics.ideology) },
    { driver: 'trade', value: Math.min(w.maxTrade, w.perTrade * trades) },
    { driver: 'embassy', value: c.embassy ? w.embassy : 0 },
    { driver: 'pact', value: hasTreaty(state, id, 'nonAggression') ? w.pact : 0 },
    { driver: 'sanctions', value: (c.sanctioned ? w.sanctions : 0) + (sanctionsIndia(state, id) ? w.sanctioning : 0) },
    { driver: 'reputation', value: w.reputation * (state.diplomacy.reputation - NEUTRAL_REPUTATION) },
    { driver: 'incidents', value: w.incidents * c.incidents },
    { driver: 'war', value: atWarWithCountry(state, id) ? w.war : 0 },
    { driver: 'tension', value: w.tension * state.diplomacy.worldTension },
  ];
}

export function relationTarget(state: GameState, id: CountryId): number {
  return clamp(
    relationDrivers(state, id).reduce((sum, l) => sum + l.value, 0),
    -100,
    100,
  );
}

export const RELATION_LEVELS = ['closeFriend', 'friendly', 'neutral', 'cool', 'hostile', 'adversary'] as const;
export type RelationLevel = (typeof RELATION_LEVELS)[number];

/** The band a relation falls in; the UI translates it, the simulation's own text uses relationWord(). */
export const relationLevel = (relation: number): RelationLevel =>
  relation >= 60
    ? 'closeFriend'
    : relation >= 25
      ? 'friendly'
      : relation > -15
        ? 'neutral'
        : relation > -45
          ? 'cool'
          : relation > -75
            ? 'hostile'
            : 'adversary';

const RELATION_WORDS: Record<RelationLevel, string> = {
  closeFriend: 'Close friend',
  friendly: 'Friendly',
  neutral: 'Neutral',
  cool: 'Cool',
  hostile: 'Hostile',
  adversary: 'Adversary',
};

export const relationWord = (relation: number): string => RELATION_WORDS[relationLevel(relation)];

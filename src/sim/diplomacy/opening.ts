import { COUNTRY_LIST } from '../content/world';
import type { CountryState, DiplomacyState } from '../state/types';
import { START_REPUTATION } from './constants';

/** Every country starts at its content relation with no treaties, offers or incidents. Draws nothing from the RNG. */
export function openingDiplomacy(): DiplomacyState {
  const countries: Record<string, CountryState> = {};
  for (const c of COUNTRY_LIST) {
    countries[c.id] = {
      relation: c.relation,
      incidents: 0,
      embassy: false,
      sanctioned: false,
      proposalReadyTick: 0,
      aidReadyTick: 0,
    };
  }
  return {
    countries,
    treaties: [],
    offers: [],
    conflicts: [],
    reputation: START_REPUTATION,
    worldTension: 20,
    ai: {},
  };
}

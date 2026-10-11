import { RIVAL_CONTENT, UNIT_CONTENT } from '../content/military';
import { DOMAINS, RIVALS, UNITS, type DomainId, type RivalId, type UnitId } from '../content/ids';
import type { MilitaryState, RivalState } from '../state/types';
import {
  START_COUNTER_INTEL,
  START_DETERRENCE,
  START_MORALE,
  START_PROCUREMENT_FUND,
  START_READINESS,
} from './constants';

export const RIVAL_START_READINESS = 70;

export function openingRival(id: RivalId): RivalState {
  const content = RIVAL_CONTENT[id];
  return {
    strength: content.strength,
    readiness: RIVAL_START_READINESS,
    relation: content.relation,
    recoverUntilTick: null,
    sighting: null,
    annexed: false,
  };
}

/** India’s armed forces at the start of a term. Deterministic: it draws nothing from the RNG. */
export function openingMilitary(): MilitaryState {
  return {
    forces: Object.fromEntries(UNITS.map((u) => [u, UNIT_CONTENT[u].start])) as Record<UnitId, number>,
    readiness: START_READINESS,
    morale: START_MORALE,
    tech: Object.fromEntries(DOMAINS.map((d) => [d, 1])) as Record<DomainId, 1 | 2 | 3>,
    research: null,
    procurementFund: START_PROCUREMENT_FUND,
    queue: [],
    drills: [],
    drillReports: [],
    deterrence: START_DETERRENCE,
    counterIntel: START_COUNTER_INTEL,
    intelOps: [],
    fundingRatio: 1.02,
    rivals: Object.fromEntries(RIVALS.map((r) => [r, openingRival(r)])) as Record<RivalId, RivalState>,
    wars: [],
    warHistory: [],
    nuclear: {
      active: false,
      research: 0,
      enrichment: 0,
      warheads: 0,
      doctrine: 'noFirstUse',
      monthsSinceWarhead: 0,
    },
  };
}

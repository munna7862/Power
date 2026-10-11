import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, type MinistryId } from '../content/ids';
import { exposeMinister } from '../cabinet/scandal';
import { allEfficiencies } from '../economy/model';
import type { Rng } from '../engine/rng';
import { appendLog } from '../state/log';
import type { GameState, Investigation } from '../state/types';
import { INVESTIGATION_COST, INVESTIGATION_DAYS, MAX_INVESTIGATIONS } from './constants';
import { clamp } from './unrest';

/** Why an investigation cannot be launched, or null. */
export function validateInvestigation(state: GameState, ministry: MinistryId): string | null {
  if (!MINISTRIES.includes(ministry)) return `Unknown ministry ${ministry}.`;
  const minister = state.cabinet.ministers[ministry];
  if (!minister) return 'There is no minister to investigate: the post is vacant.';
  if (state.security.investigations.some((i) => i.ministry === ministry)) {
    return `An inquiry into ${minister.name} is already under way.`;
  }
  if (state.security.investigations.length >= MAX_INVESTIGATIONS) {
    return `The agency can only run ${MAX_INVESTIGATIONS} inquiries at a time.`;
  }
  return null;
}

export function startInvestigation(state: GameState, ministry: MinistryId): GameState {
  const minister = state.cabinet.ministers[ministry];
  const investigation: Investigation = {
    id: `inv-${state.nextId}`,
    ministry,
    startedTick: state.clock.tick,
    resolvesTick: state.clock.tick + INVESTIGATION_DAYS,
  };
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury - INVESTIGATION_COST },
      security: { ...state.security, investigations: [...state.security.investigations, investigation] },
      nextId: state.nextId + 1,
    },
    {
      severity: 'info',
      category: 'corruption',
      title: `Inquiry opened: ${MINISTRY_CONTENT[ministry].shortName}`,
      body: `The anti-corruption agency begins quietly examining ${minister?.name ?? 'the ministry'}'s accounts. Results are expected in about two months.`,
    },
  );
}

/** Chance an inquiry uncovers wrongdoing: more likely when the minister is corrupt and the agency is well funded. */
export function exposureChance(corruption: number, antiCorruptionEfficiency: number): number {
  return clamp((corruption / 100) * (0.5 + 0.5 * Math.min(antiCorruptionEfficiency, 1.6)) + 0.05, 0.05, 0.9);
}

/** Settles an inquiry whose time has come. */
export function resolveInvestigation(state: GameState, investigation: Investigation, rng: Rng): GameState {
  const remaining = state.security.investigations.filter((i) => i.id !== investigation.id);
  let next: GameState = { ...state, security: { ...state.security, investigations: remaining } };
  const minister = next.cabinet.ministers[investigation.ministry];
  if (!minister) {
    return appendLog(next, {
      severity: 'info',
      category: 'corruption',
      title: 'Inquiry closed',
      body: `The ${MINISTRY_CONTENT[investigation.ministry].shortName} inquiry was closed because the minister had already left.`,
    });
  }
  if (rng.chance(exposureChance(minister.corruption, allEfficiencies(next).antiCorruption))) {
    next = exposeMinister(
      next,
      investigation.ministry,
      'An anti-corruption inquiry found that ministry funds had been diverted.',
    );
    return {
      ...next,
      economy: { ...next.economy, corruption: clamp(next.economy.corruption - 3, 0, 100) },
    };
  }
  const ministers = {
    ...next.cabinet.ministers,
    [investigation.ministry]: { ...minister, loyalty: clamp(minister.loyalty - 3, 0, 100) },
  };
  return appendLog(
    { ...next, cabinet: { ...next.cabinet, ministers } },
    {
      severity: 'info',
      category: 'corruption',
      title: `Inquiry finds no wrongdoing: ${MINISTRY_CONTENT[investigation.ministry].shortName}`,
      body: `Investigators found nothing against ${minister.name}. The minister is said to be unhappy about being investigated.`,
    },
  );
}

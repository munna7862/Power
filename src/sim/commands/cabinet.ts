import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, type MinistryId } from '../content/ids';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState, Minister } from '../state/types';

/** Approval cost of removing a serving minister. */
export const RESHUFFLE_APPROVAL = -2;
export const RESHUFFLE_DAYS = 90;
/** Loyalty lost by every other minister when a colleague is removed. */
export const RESHUFFLE_LOYALTY = -3;

/** Removes the serving minister (if any) and charges the reshuffle cost. */
function removeMinister(state: GameState, ministry: MinistryId): GameState {
  const outgoing = state.cabinet.ministers[ministry];
  if (!outgoing) return state;
  const ministers = { ...state.cabinet.ministers, [ministry]: null } as Record<MinistryId, Minister | null>;
  for (const m of MINISTRIES) {
    const minister = ministers[m];
    if (minister) ministers[m] = { ...minister, loyalty: Math.max(0, minister.loyalty + RESHUFFLE_LOYALTY) };
  }
  return addTimedModifier(
    { ...state, cabinet: { ...state.cabinet, ministers } },
    {
      source: 'reshuffle',
      label: `Reshuffle: ${outgoing.name} removed`,
      target: 'politics.approvalTarget',
      kind: 'add',
      value: RESHUFFLE_APPROVAL,
    },
    RESHUFFLE_DAYS,
  );
}

export function validateAppointment(state: GameState, ministry: MinistryId, candidateId: string): string | null {
  if (!MINISTRIES.includes(ministry)) return `Unknown ministry ${ministry}.`;
  if (!state.cabinet.candidates[ministry].some((c) => c.id === candidateId)) {
    return 'That candidate is not available for this ministry.';
  }
  return null;
}

export function appointMinister(state: GameState, ministry: MinistryId, candidateId: string): GameState {
  const candidate = state.cabinet.candidates[ministry].find((c) => c.id === candidateId) as Minister;
  const cleared = removeMinister(state, ministry);
  const next: GameState = {
    ...cleared,
    cabinet: {
      ministers: { ...cleared.cabinet.ministers, [ministry]: { ...candidate, appointedTick: state.clock.tick } },
      candidates: {
        ...cleared.cabinet.candidates,
        [ministry]: cleared.cabinet.candidates[ministry].filter((c) => c.id !== candidateId),
      },
    },
  };
  return appendLog(next, {
    severity: 'info',
    title: `New minister: ${MINISTRY_CONTENT[ministry].shortName}`,
    body: `${candidate.name} is sworn in as head of the ${MINISTRY_CONTENT[ministry].name}.`,
  });
}

export function dismissMinister(state: GameState, ministry: MinistryId): GameState {
  const outgoing = state.cabinet.ministers[ministry] as Minister;
  return appendLog(removeMinister(state, ministry), {
    severity: 'warning',
    title: `Minister dismissed: ${MINISTRY_CONTENT[ministry].shortName}`,
    body: `${outgoing.name} has been dismissed. A senior civil servant runs the ministry until a successor is appointed.`,
  });
}

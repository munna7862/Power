import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, type MinistryId } from '../content/ids';
import type { Rng } from '../engine/rng';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';

/** Approval hit while an exposed minister is in the news. */
export const EXPOSURE_APPROVAL = -3;
export const EXPOSURE_DAYS = 90;

/** Picks a serving minister, favouring the corrupt (weight = corruption² + 1). Null if the cabinet is empty. */
export function pickCorruptMinister(state: GameState, rng: Rng): MinistryId | null {
  const serving = MINISTRIES.filter((m) => state.cabinet.ministers[m] !== null);
  if (serving.length === 0) return null;
  const weights = serving.map((m) => (state.cabinet.ministers[m]?.corruption ?? 0) ** 2 + 1);
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < serving.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return serving[i] as MinistryId;
  }
  return serving[serving.length - 1] as MinistryId;
}

/**
 * Closes any anti-corruption inquiry into a ministry whose minister is leaving. An inquiry is about a person:
 * it must never pass judgement on whoever is appointed next.
 */
export function closeInquiries(state: GameState, ministry: MinistryId): GameState {
  const remaining = state.security.investigations.filter((i) => i.ministry !== ministry);
  if (remaining.length === state.security.investigations.length) return state;
  return appendLog(
    { ...state, security: { ...state.security, investigations: remaining } },
    {
      severity: 'info',
      category: 'corruption',
      title: 'Inquiry closed',
      body: `The ${MINISTRY_CONTENT[ministry].shortName} inquiry was closed because the minister has left office.`,
    },
  );
}

/** A minister is exposed and resigns. The post is left vacant for the President to fill. */
export function exposeMinister(state: GameState, ministry: MinistryId, reason: string): GameState {
  const minister = state.cabinet.ministers[ministry];
  if (!minister) return state;
  const next = addTimedModifier(
    closeInquiries(
      { ...state, cabinet: { ...state.cabinet, ministers: { ...state.cabinet.ministers, [ministry]: null } } },
      ministry,
    ),
    {
      source: 'scandal',
      label: `Scandal: ${minister.name} resigns`,
      target: 'politics.approvalTarget',
      kind: 'add',
      value: EXPOSURE_APPROVAL,
    },
    EXPOSURE_DAYS,
  );
  return appendLog(next, {
    severity: 'warning',
    category: 'corruption',
    title: `${MINISTRY_CONTENT[ministry].shortName} minister resigns`,
    body: `${minister.name} resigned as head of the ${MINISTRY_CONTENT[ministry].name}. ${reason} A civil servant runs the ministry until you appoint a successor.`,
  });
}

import { formatDate } from '../engine/calendar';
import type { System } from '../engine/system';
import { addModifier } from '../politics/policy';
import { rulesFor } from '../state/difficulty';
import { endGame } from '../state/gameOver';
import { appendLog } from '../state/log';
import { TERM_YEARS, type GameState } from '../state/types';

/** The calendar year the term ends in: election day is 1 January of that year. */
export const electionYear = (state: Pick<GameState, 'meta'>): number => state.meta.startDate.year + TERM_YEARS;

/** Approval needed on election day to win a second term. */
export const reelectionApproval = (state: Pick<GameState, 'meta'>): number => rulesFor(state).reelectionApproval;

/** The campaign can move the result by up to this many points either way on election day. */
export const ELECTION_SWING = 4;

/** Voter fatigue grows for this many years and then holds. */
export const FATIGUE_MAX_YEARS = 4;

export const FATIGUE_SOURCE = 'fatigue';

/** Full years in office after the first, as voter fatigue counts them. */
export const fatigueYears = (state: Pick<GameState, 'meta' | 'clock'>): number =>
  Math.min(FATIGUE_MAX_YEARS, Math.max(0, state.clock.date.year - state.meta.startDate.year - 1));

/** The approval-target penalty voter fatigue sets this year (0 or negative). */
export const voterFatigue = (state: Pick<GameState, 'meta' | 'clock'>): number =>
  -rulesFor(state).voterFatigue * fatigueYears(state);

/** Replaces last year's voter-fatigue modifier with this year's (a modifier, so the "Why?" tooltip shows it). */
function refreshFatigue(state: GameState): GameState {
  const value = voterFatigue(state);
  const kept = state.modifiers.filter((m) => m.source !== FATIGUE_SOURCE);
  if (value === 0) return kept.length === state.modifiers.length ? state : { ...state, modifiers: kept };
  const years = fatigueYears(state);
  let next = addModifier(
    { ...state, modifiers: kept },
    {
      source: FATIGUE_SOURCE,
      label: `Voter fatigue (${years + 1} years in office)`,
      target: 'politics.approvalTarget',
      kind: 'add',
      value,
    },
    null,
  );
  if (years === 1) {
    next = appendLog(next, {
      severity: 'info',
      title: 'The honeymoon is over',
      body: `Voters judge a government more harshly the longer it serves. Voter fatigue now costs ${-value} points of approval and grows every year until election day.`,
    });
  }
  return next;
}

/**
 * The presidential term. Every 1 January voter fatigue grows a little. On election day, 1 January after five
 * years in office, the voters decide: approval plus a small campaign swing at or above the difficulty's
 * threshold wins a second term (a victory); anything less ends the presidency. A re-elected President may
 * stay on in endless mode, after which no further elections are held.
 */
export const termSystem: System = {
  id: 'term',
  cadence: 'yearly',
  run(state, { rng }) {
    if (state.status.kind === 'over') return state;
    if (state.meta.endless || state.clock.date.year < electionYear(state)) return refreshFatigue(state);

    const approval = state.nation.approval;
    const swing = rng.range(-ELECTION_SWING, ELECTION_SWING);
    const result = approval + swing;
    const needed = reelectionApproval(state);
    const name = state.meta.presidentName;
    const date = formatDate(state.clock.date);
    const campaign = `${swing >= 0 ? '+' : '−'}${Math.abs(swing).toFixed(1)}`;
    if (result >= needed) {
      return endGame(
        state,
        'reelected',
        'Re-elected',
        `${name} completed the ${TERM_YEARS}-year term and won the election on ${date}: ${approval.toFixed(1)}% approval with a campaign swing of ${campaign} cleared the ${needed}% needed. The nation has given you a second term.`,
      );
    }
    return endGame(
      state,
      'votedOut',
      'Voted out',
      `${name} completed the ${TERM_YEARS}-year term, but on election day (${date}) ${approval.toFixed(1)}% approval with a campaign swing of ${campaign} fell short of the ${needed}% needed. The voters chose someone else.`,
    );
  },
};

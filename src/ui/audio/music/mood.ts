import { electionYear, IMPEACHMENT_THRESHOLD, nationalUnrest, RIOT_TRIGGER, type GameState } from '../../../sim';
import type { MusicStyle } from '../../../platform/settings';
import type { Screen } from '../../../store/gameStore';
import type { MoodState } from './moods';

/** Approval this close above the impeachment line makes the music tense. */
export const TENSE_APPROVAL_MARGIN = 10;
/** The election build-up starts this many months before election day. */
export const ELECTION_BUILD_MONTHS = 6;

/** Months from the start of the current month to election day (1 January of the election year). */
export const monthsToElection = (game: Pick<GameState, 'meta' | 'clock'>): number =>
  (electionYear(game) - game.clock.date.year) * 12 - (game.clock.date.month - 1);

/**
 * The soundtrack's mood, read from the game the player sees. War outranks tension, which outranks the election;
 * "Calm only" never leaves the menu and governance moods. Reads the simulation, never changes it.
 */
export function moodFor(screen: Screen, game: GameState | null, style: MusicStyle): MoodState {
  if (screen !== 'game' || !game || game.status.kind === 'over') return { mood: 'menu', intensity: 0 };
  if (style === 'calm') return { mood: 'governance', intensity: 0 };
  if (game.military.wars.some((w) => w.status === 'active')) return { mood: 'war', intensity: 1 };
  const unrest = nationalUnrest(game);
  const approval = game.nation.approval;
  const tenseApproval = IMPEACHMENT_THRESHOLD + TENSE_APPROVAL_MARGIN;
  if (unrest >= RIOT_TRIGGER || approval <= tenseApproval) {
    const fromUnrest = (unrest - RIOT_TRIGGER) / (100 - RIOT_TRIGGER);
    const fromApproval = (tenseApproval - approval) / tenseApproval;
    return { mood: 'tension', intensity: Math.min(1, Math.max(0, fromUnrest, fromApproval)) };
  }
  const months = monthsToElection(game);
  if (!game.meta.endless && months > 0 && months <= ELECTION_BUILD_MONTHS) {
    return { mood: 'election', intensity: (ELECTION_BUILD_MONTHS - months) / (ELECTION_BUILD_MONTHS - 1) };
  }
  return { mood: 'governance', intensity: 0 };
}

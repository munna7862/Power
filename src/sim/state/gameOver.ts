import { appendLog } from './log';
import type { GameOverCause, GameState } from './types';

/**
 * Ends the presidency. Does nothing if the game is already over, so two systems
 * can never end the same game twice on one tick.
 */
export function endGame(state: GameState, cause: GameOverCause, title: string, summary: string): GameState {
  if (state.status.kind === 'over') return state;
  return appendLog(
    { ...state, status: { kind: 'over', cause, date: state.clock.date, title, summary } },
    { severity: 'critical', title, body: summary },
  );
}

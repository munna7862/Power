import { SYSTEMS } from '../systems';
import type { GameState } from '../state/types';
import { advanceDay } from './calendar';
import { Rng } from './rng';
import type { System } from './system';

/**
 * Advances the game by one day and returns a new state. The input state is never mutated.
 * Once the game is over, time stops: the state is returned unchanged.
 */
export function tick(state: GameState, systems: readonly System[] = SYSTEMS): GameState {
  if (state.status.kind === 'over') return state;
  const rng = new Rng(state.rng);
  const { date, monthChanged, yearChanged } = advanceDay(state.clock.date);
  let next: GameState = { ...state, clock: { tick: state.clock.tick + 1, date } };

  for (const system of systems) {
    const due =
      system.cadence === 'daily' ||
      (system.cadence === 'monthly' && monthChanged) ||
      (system.cadence === 'yearly' && yearChanged);
    if (due) next = system.run(next, { rng });
  }

  return { ...next, rng: rng.state };
}

/** Advances the game by `days` ticks, stopping early if the game ends. */
export function advanceDays(state: GameState, days: number, systems: readonly System[] = SYSTEMS): GameState {
  let next = state;
  for (let i = 0; i < days && next.status.kind === 'playing'; i++) next = tick(next, systems);
  return next;
}

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

/**
 * Advances up to `days` ticks like advanceDays, but stops early (after the tick it happens on) when the
 * President needs to look: a critical inbox entry arrives or a new decision is waiting.
 * Returns the new state and whether it stopped early.
 */
export function advanceUntilAttention(
  state: GameState,
  days: number,
  systems: readonly System[] = SYSTEMS,
): { state: GameState; interrupted: boolean } {
  let next = state;
  for (let i = 0; i < days && next.status.kind === 'playing'; i++) {
    const logBefore = next.log.length;
    const pendingBefore = next.events.pending.length;
    next = tick(next, systems);
    const fresh = next.log.slice(logBefore > next.log.length ? 0 : logBefore);
    const newCritical = fresh.some((e) => e.severity === 'critical');
    if (newCritical || next.events.pending.length > pendingBefore) return { state: next, interrupted: true };
  }
  return { state: next, interrupted: false };
}

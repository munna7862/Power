import type { GameState } from '../state/types';
import type { Rng } from './rng';

export type Cadence = 'daily' | 'monthly' | 'yearly';

export interface SystemContext {
  rng: Rng;
}

/**
 * A simulation system. Systems run in the fixed order of the registry
 * (systems/index.ts), each only on ticks matching its cadence:
 * - daily: every tick
 * - monthly: on the first day of each month (settling the month just closed)
 * - yearly: on 1 January (settling the year just closed)
 */
export interface System {
  id: string;
  cadence: Cadence;
  run(state: GameState, ctx: SystemContext): GameState;
}

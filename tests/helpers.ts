import {
  advanceDays,
  createInitialState,
  DEPARTMENT_SERVICES,
  type GameState,
  type MinistryId,
  type NewGameOptions,
} from '../src/sim';
import { SYSTEMS } from '../src/sim/systems';

export const DEFAULT_OPTIONS: NewGameOptions = {
  seed: 42,
  difficulty: 'normal',
  presidentName: 'Test President',
  startYear: 2026,
};

export function newGame(overrides: Partial<NewGameOptions> = {}): GameState {
  return createInitialState({ ...DEFAULT_OPTIONS, ...overrides });
}

/** The same game in endless mode: no election ends it after five years. For tests that run longer than a term. */
export const endless = (state: GameState): GameState => ({ ...state, meta: { ...state.meta, endless: true } });

/** Recursively freezes an object so any accidental mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** The Phase 2 systems only: no events, unrest, terror or leadership threats, so a hands-off game cannot end early. */
export const CALM_SYSTEMS = SYSTEMS.filter(
  (s) => !['events', 'unrest', 'terror', 'plots', 'leadership', 'investigations'].includes(s.id),
);

export const calm = (state: GameState, days: number): GameState => advanceDays(state, days, CALM_SYSTEMS);

/** The same game with every service of a department at the given star rating (1–5). */
export function withStars(state: GameState, department: MinistryId, stars: number): GameState {
  const services = Object.fromEntries(DEPARTMENT_SERVICES[department].map((s) => [s, stars]));
  return {
    ...state,
    departments: { ...state.departments, stars: { ...state.departments.stars, [department]: services } },
  };
}

import { createInitialState, type GameState, type NewGameOptions } from '../src/sim';

export const DEFAULT_OPTIONS: NewGameOptions = {
  seed: 42,
  difficulty: 'normal',
  presidentName: 'Test President',
  startYear: 2026,
};

export function newGame(overrides: Partial<NewGameOptions> = {}): GameState {
  return createInitialState({ ...DEFAULT_OPTIONS, ...overrides });
}

/** Recursively freezes an object so any accidental mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

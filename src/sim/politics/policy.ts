import { IDEOLOGY_CONTENT, STRATEGY_CONTENT } from '../content';
import type { IdeologyId, StrategyId } from '../content/ids';
import type { Modifier } from '../engine/modifiers';
import type { GameState } from '../state/types';

export type PolicySource = 'ideology' | 'strategy';

/** Days before an ideology or strategy can be changed again. */
export const POLICY_COOLDOWN_DAYS = 365;

function policyModifiers(source: PolicySource, id: IdeologyId | StrategyId, firstId: number): Modifier[] {
  const content = source === 'ideology' ? IDEOLOGY_CONTENT[id as IdeologyId] : STRATEGY_CONTENT[id as StrategyId];
  const label = `${source === 'ideology' ? 'Ideology' : 'Strategy'}: ${content.name}`;
  return content.modifiers.map((m, i) => ({ ...m, id: `mod-${firstId + i}`, source, label, expiresAtTick: null }));
}

/** Swaps the permanent modifiers granted by the current ideology or strategy. */
export function applyPolicy(state: GameState, source: PolicySource, id: IdeologyId | StrategyId): GameState {
  const added = policyModifiers(source, id, state.nextId);
  return {
    ...state,
    modifiers: [...state.modifiers.filter((m) => m.source !== source), ...added],
    nextId: state.nextId + added.length,
  };
}

/** Adds a temporary modifier (scandals, reshuffles, tax announcements…). */
export function addTimedModifier(
  state: GameState,
  modifier: Omit<Modifier, 'id' | 'expiresAtTick'>,
  days: number,
): GameState {
  const full: Modifier = { ...modifier, id: `mod-${state.nextId}`, expiresAtTick: state.clock.tick + days };
  return { ...state, modifiers: [...state.modifiers, full], nextId: state.nextId + 1 };
}

/** Adds a modifier that lasts `days` days, or forever when `days` is null (events with lasting consequences). */
export function addModifier(
  state: GameState,
  modifier: Omit<Modifier, 'id' | 'expiresAtTick'>,
  days: number | null,
): GameState {
  const full: Modifier = {
    ...modifier,
    id: `mod-${state.nextId}`,
    expiresAtTick: days === null ? null : state.clock.tick + days,
  };
  return { ...state, modifiers: [...state.modifiers, full], nextId: state.nextId + 1 };
}

/**
 * Sets a modifier that a monthly system refreshes (war weariness, sanction pressure…): any earlier modifier
 * with the same source and label is replaced, so the stack never grows.
 */
export function replaceTimedModifier(
  state: GameState,
  modifier: Omit<Modifier, 'id' | 'expiresAtTick'>,
  days: number,
): GameState {
  const kept = state.modifiers.filter((m) => !(m.source === modifier.source && m.label === modifier.label));
  return addTimedModifier({ ...state, modifiers: kept }, modifier, days);
}

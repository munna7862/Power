import { normalisePresidentName, PRESIDENT_NAME_MAX } from '../state/initialState';
import type { GameState } from '../state/types';

/** Player actions. Every change a player makes to GameState goes through dispatch(). */
export type Command =
  { type: 'SET_PRESIDENT_NAME'; name: string } | { type: 'MARK_LOG_READ'; id: string } | { type: 'MARK_ALL_LOG_READ' };

export type CommandResult = { ok: true; state: GameState } | { ok: false; error: string; state: GameState };

const fail = (state: GameState, error: string): CommandResult => ({ ok: false, error, state });

export function dispatch(state: GameState, command: Command): CommandResult {
  switch (command.type) {
    case 'SET_PRESIDENT_NAME': {
      const trimmed = command.name.trim();
      if (trimmed.length < 2) return fail(state, 'Name must be at least 2 characters.');
      if (trimmed.length > PRESIDENT_NAME_MAX) {
        return fail(state, `Name must be at most ${PRESIDENT_NAME_MAX} characters.`);
      }
      return {
        ok: true,
        state: { ...state, meta: { ...state.meta, presidentName: normalisePresidentName(trimmed) } },
      };
    }
    case 'MARK_LOG_READ': {
      if (!state.log.some((e) => e.id === command.id)) return fail(state, `No inbox entry with id ${command.id}.`);
      return {
        ok: true,
        state: { ...state, log: state.log.map((e) => (e.id === command.id ? { ...e, read: true } : e)) },
      };
    }
    case 'MARK_ALL_LOG_READ':
      return { ok: true, state: { ...state, log: state.log.map((e) => (e.read ? e : { ...e, read: true })) } };
  }
}

import { LOG_LIMIT, type GameState, type LogEntry } from './types';

export type NewLogEntry = Pick<LogEntry, 'severity' | 'title' | 'body'>;

/** Appends an inbox entry stamped with the current game date, keeping at most LOG_LIMIT entries. */
export function appendLog(state: GameState, entry: NewLogEntry): GameState {
  const full: LogEntry = {
    ...entry,
    id: `log-${state.nextId}`,
    tick: state.clock.tick,
    date: state.clock.date,
    read: false,
  };
  const log = [...state.log, full];
  return { ...state, log: log.length > LOG_LIMIT ? log.slice(log.length - LOG_LIMIT) : log, nextId: state.nextId + 1 };
}

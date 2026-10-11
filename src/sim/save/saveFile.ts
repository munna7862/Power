import { formatDate } from '../engine/calendar';
import { SCHEMA_VERSION, type Difficulty, type GameState } from '../state/types';
import { hashState } from './hash';
import { migrate } from './migrations';
import { gameStateSchema } from './schema';

export const SAVE_FORMAT = 'india-apex-sovereign/save';

/** Lightweight metadata shown in save-slot lists. */
export interface SaveSummary {
  presidentName: string;
  difficulty: Difficulty;
  /** e.g. "14 Mar 2027" */
  gameDate: string;
  tick: number;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  schemaVersion: number;
  /** ISO timestamp supplied by the platform layer. */
  savedAt: string;
  /** hashState(state), verified on load to detect corruption. */
  checksum: string;
  summary: SaveSummary;
  state: GameState;
}

export type ParseResult = { ok: true; save: SaveFile } | { ok: false; error: string };

export function createSaveFile(state: GameState, savedAt: string): SaveFile {
  return {
    format: SAVE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    savedAt,
    checksum: hashState(state),
    summary: {
      presidentName: state.meta.presidentName,
      difficulty: state.meta.difficulty,
      gameDate: formatDate(state.clock.date),
      tick: state.clock.tick,
    },
    state,
  };
}

export function serializeSave(state: GameState, savedAt: string): string {
  return JSON.stringify(createSaveFile(state, savedAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses, verifies, migrates and validates a save. Never throws. */
export function parseSave(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Save file is not valid JSON.' };
  }
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT) {
    return { ok: false, error: 'Not an India: Apex Sovereign save file.' };
  }
  if (typeof raw.schemaVersion !== 'number' || typeof raw.savedAt !== 'string' || typeof raw.checksum !== 'string') {
    return { ok: false, error: 'Save file header is incomplete.' };
  }
  if (hashState(raw.state) !== raw.checksum) {
    return { ok: false, error: 'Save file is corrupted (checksum mismatch).' };
  }

  let migrated: unknown;
  try {
    migrated = migrate(raw.state, raw.schemaVersion);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  const parsed = gameStateSchema.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join('.') || 'root';
    return { ok: false, error: `Save data is invalid at ${path}: ${issue?.message ?? 'unknown error'}` };
  }
  return { ok: true, save: createSaveFile(parsed.data as GameState, raw.savedAt) };
}

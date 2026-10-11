/** Public API of the simulation core. UI and platform code import from here only. */
export * from './engine/calendar';
export { resolve, type Modifier, type ModifierTarget, type Resolution, type BreakdownLine } from './engine/modifiers';
export { groupIndian } from './engine/numberFormat';
export { tick, advanceDays } from './engine/tick';
export * from './state/types';
export {
  createInitialState,
  normalisePresidentName,
  DEFAULT_PRESIDENT_NAME,
  PRESIDENT_NAME_MAX,
  type NewGameOptions,
} from './state/initialState';
export { dispatch, type Command, type CommandResult } from './commands';
export { hashState } from './save/hash';
export {
  serializeSave,
  parseSave,
  createSaveFile,
  SAVE_FORMAT,
  type SaveFile,
  type SaveSummary,
  type ParseResult,
} from './save/saveFile';

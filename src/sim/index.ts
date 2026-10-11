/** Public API of the simulation core. UI, platform and tools import from here only. */
export * from './engine/calendar';
export {
  resolve,
  sumAdd,
  MODIFIER_TARGETS,
  type Modifier,
  type ModifierTarget,
  type Resolution,
  type BreakdownLine,
} from './engine/modifiers';
export { groupIndian } from './engine/numberFormat';
export { tick, advanceDays } from './engine/tick';
export * from './state/types';
export * from './content/ids';
export { MINISTRY_CONTENT, IDEOLOGY_CONTENT, STRATEGY_CONTENT, type PolicyContent } from './content';
export {
  createInitialState,
  normalisePresidentName,
  DEFAULT_PRESIDENT_NAME,
  DEFAULT_IDEOLOGY,
  DEFAULT_STRATEGY,
  PRESIDENT_NAME_MAX,
  type NewGameOptions,
} from './state/initialState';
export {
  dispatch,
  policyCooldownDays,
  POLICY_CHANGE_COST,
  type Command,
  type CommandResult,
  type BudgetProposal,
} from './commands';
export { nextBudgetDate, allocationBounds, announcementEffect, validateBudget } from './commands/budget';
export { RESHUFFLE_APPROVAL } from './commands/cabinet';
export {
  ALLOCATION_LIMITS,
  BUDGET_COOLDOWN_DAYS,
  DEFAULT_TAX_RATES,
  MAX_TAX_STEP,
  TAX_LIMITS,
} from './economy/constants';
export {
  allEfficiencies,
  debtToGdp,
  lastDeficitRatio,
  ministryEfficiency,
  nominalGdp,
  projectMonth,
  realGdp,
  sectorShare,
  type FiscalProjection,
} from './economy/model';
export { explainGrowth, GROWTH_DRIVER_LABELS, type GrowthDriver } from './economy/growth';
export {
  APPROVAL_FACTOR_LABELS,
  APPROVAL_WEIGHTS,
  IMPEACHMENT_MONTHS,
  IMPEACHMENT_THRESHOLD,
  approvalTarget,
  computeSatisfaction,
  topIssues,
} from './politics/approval';
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
export {
  EVENT_CONTENT,
  EVENT_LIST,
  THREAT_GROUPS,
  type EventContent,
  type EventChoice,
  type EventEffect,
} from './content/events';
export { describeEffect, choiceUtility, pendingView, type EffectLine, type PendingView } from './events/describe';
export { statValue, STAT_IDS, type StatId } from './events/stats';
export { MAX_PENDING, raiseEvent } from './events/engine';
export {
  BANKRUPTCY_DEBT_RATIO,
  BANKRUPTCY_MONTHS,
  COUP_RISK_THRESHOLD,
  INVESTIGATION_COST,
  INVESTIGATION_DAYS,
  MAX_INVESTIGATIONS,
  OPERATIONS,
  RIOT_UNREST,
  TENSE_UNREST,
} from './security/constants';
export { unrestTarget, type Driver, type Explained } from './security/unrest';
export {
  averageUnrest,
  hasOperation,
  intelligenceFoilChance,
  plotFormationChance,
  plotSuccessChance,
  terrorTarget,
} from './security/terror';
export {
  assassinationAttemptChance,
  assassinationSuccessChance,
  coupChance,
  coupRisk,
  presidentialSafety,
} from './security/leadership';
export { exposureChance, validateInvestigation } from './security/investigations';
export { operationBlocked } from './security/operations';
export { nationalLeakageFactor } from './economy/model';
export { advanceUntilAttention } from './engine/tick';

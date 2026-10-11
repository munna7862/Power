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
  TUTORIAL_EVENT,
  TUTORIAL_EVENT_DAY,
  type NewGameOptions,
} from './state/initialState';
export { DIFFICULTY_RULES, rulesFor, type DifficultyRules } from './state/difficulty';
export { electionYear, reelectionApproval } from './systems/term';
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
  impeachmentThreshold,
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
  isRiotEvent,
  RIOT_TRIGGER,
  unrestTrigger,
  type EventContent,
  type EventChoice,
  type EventEffect,
} from './content/events';
export { describeEffect, choiceUtility, pendingView, type EffectLine, type PendingView } from './events/describe';
export { statValue, STAT_IDS, type StatId } from './events/stats';
export { MAX_PENDING, MAX_REPEATS, raiseEvent, recentFires, REPEAT_WINDOW_DAYS } from './events/engine';
export {
  BANKRUPTCY_DEBT_RATIO,
  BANKRUPTCY_MONTHS,
  COUP_RISK_THRESHOLD,
  INVESTIGATION_COST,
  INVESTIGATION_DAYS,
  MAX_INVESTIGATIONS,
  NO_RIOTS_UNREST_CAP,
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
export { UNIT_CONTENT, RESEARCH_LIST, RIVAL_CONTENT, researchNode } from './content/military';
export type { UnitContent, ResearchContent, RivalContent, FrontContent } from './content/military';
export {
  DRILLS,
  FUND_CAP_MONTHS,
  INTEL_OPS,
  MAX_DRILLS,
  MAX_INTEL_OPS,
  MAX_ORDER_SIZE,
  MAX_QUEUE,
  NUCLEAR,
  TIER_COST,
  TIER_POWER,
  WAR,
  type DrillSpec,
  type IntelSpec,
} from './military/constants';
export {
  domainRaw,
  domainStrength,
  enemyFrontPower,
  frontPower,
  militaryStrength,
  monthlyUpkeep,
  moraleFactor,
  personnel,
  readinessFactor,
  rivalEffective,
  strengthView,
  unitCost,
  unitGeneration,
  unitsIn,
  unitUpkeep,
  type StrengthView,
} from './military/strength';
export { fundingFor, moraleTarget, orderCost, readinessTarget, type Funding } from './military/forces';
export { deterrenceTarget } from './military/deterrence';
export { directorCompetence, exposureOnFailure, opSuccessChance } from './military/intel';
export { atWarWith, declarationChance, hostility, tensionTarget } from './military/rivals';
export {
  frontOdds,
  frontRound,
  MAX_WARS,
  reparationsFor,
  warScore,
  type FrontOdds,
  type FrontRoundResult,
  type PeaceTerms,
} from './military/war';
export { nuclearDeterrence, nuclearStage, programStarted, type NuclearStage } from './military/nuclear';
export { openingMilitary } from './military/opening';
/** For debug hooks and tests: a rival declares war on India. */
export { startWar } from './military/war';
export { COUNTRY_CONTENT, COUNTRY_LIST, COUNTRY_IDS, FOCUS_IDS, type CountryContent } from './content/world';
export {
  AID,
  AID_COOLDOWN,
  EMBASSY,
  MAX_OFFERS,
  MAX_TRADE_TREATIES,
  OFFER_DAYS,
  PACT_YEARS,
  SANCTIONS,
  SECTOR_LABELS,
  TRADE_SIZES,
  TRADE_YEARS,
  ideologyMatch,
  type AidSize,
  type TradeSize,
} from './diplomacy/constants';
export {
  countryState,
  hasTreaty,
  indiaPower,
  relationDrivers,
  relationOf,
  relationTarget,
  relationWord,
  sanctionsIndia,
  treatiesWith,
  type RelationLine,
} from './diplomacy/relations';
export {
  activeTrade,
  describeOffer,
  pactAcceptance,
  partnerOf,
  tradeAcceptance,
  tradeCap,
  tradeEffect,
  tradeSizesFor,
  tradeValue,
  validateAid,
  validateBreak,
  validateEmbassy,
  validateLift,
  validateOffer,
  validatePact,
  validateSanctions,
  validateTrade,
  type AcceptanceLine,
} from './diplomacy/treaties';
export { UNAVAILABLE, bestAction, scoreActions, type AiScoring } from './diplomacy/ai';
export { reputationTarget } from './diplomacy/monthly';
export { countriesInConflict, hasPact, pickCountry } from './diplomacy/world';

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
export {
  DEPARTMENT_CONTENT,
  MINISTRY_CONTENT,
  IDEOLOGY_CONTENT,
  STRATEGY_CONTENT,
  type PolicyContent,
  type ServiceContent,
} from './content';
export {
  MAX_STARS,
  MAX_UPGRADES,
  OPENING_STARS,
  QUALITY_BASE,
  QUALITY_PER_STAR,
  UNDERFUNDED_BELOW,
  UNDERFUNDED_MONTHS,
  UPGRADE_DAYS,
} from './departments/constants';
export {
  commandConfidence,
  departmentFunding,
  departmentQuality,
  departmentStars,
  intelligenceSkill,
  leakagePressure,
  protectionScore,
  serviceStars,
} from './departments/quality';
export { upgradeCost, validateUpgrade } from './departments/services';
export { FACILITY_CONTENT, type FacilityContent } from './content/infrastructure';
export {
  AREA_WEIGHTS,
  CANCEL_REFUND,
  COVERAGE_CEILING,
  COVERAGE_IMPACT,
  MAX_BUILD_QUANTITY,
  MAX_BUILD_QUEUE,
  REGION_POPULATION_SHARE,
  type CoverageEffect,
} from './infrastructure/constants';
export {
  coverage,
  coverageEffect,
  coverageIndex,
  effectiveCoverage,
  explainCoverage,
  facilitiesForTarget,
  facilityCount,
  facilitiesIn,
  facilityUpkeep,
  regionPopulation,
  type CoverageLine,
} from './infrastructure/coverage';
export { buildCost, validateBuild, validateCancelBuild, validateDemolish } from './infrastructure/build';
export { PLANT_CONTENT, type PlantContent } from './content/power';
export { GOOD_CONTENT, INDUSTRY_CONTENT, type GoodContent, type IndustryContent } from './content/goods';
export {
  DEFAULT_TARIFF,
  INDUSTRY_CANCEL_REFUND,
  LICENCE_DAYS,
  MAX_INDUSTRY_ORDER,
  MAX_INDUSTRY_QUEUE,
  MAX_TARIFF,
  STOCK_TARGET_MONTHS,
  STORAGE_MONTHS,
} from './industry/constants';
export {
  businessClimate,
  computeFlows,
  goodDemand,
  goodsInflation,
  industryJobs,
  OPENING_SETTLEMENT,
  ownedCount,
  plantCount,
  plantProfit,
  surplus,
} from './industry/flows';
export {
  industryCost,
  salePrice,
  validateCancelIndustry,
  validateCloseIndustry,
  validateIndustry,
  validateLicence,
  validateSellPlant,
} from './industry/build';
export { MAX_CONTRACT_YEARS, MAX_SUPPLY_CONTRACTS, WORLD_MARKET_DISCOUNT } from './market/constants';
export {
  partnerCapacity,
  partnerPrice,
  partnerProblem,
  quotes,
  spreadOf,
  TRADE_PARTNERS,
  type Quote,
  type SpreadLine,
  type TradeSide,
} from './market/pricing';
export {
  supplyContracts,
  surplusPlan,
  validateBuy,
  validateContract,
  validateControl,
  validateSell,
  validateSellAll,
  validateWorldSale,
} from './market/trade';
export {
  COUNTRY_LOAN_CAP,
  INTL_LENDER,
  INTL_LOAN_CAP,
  LENDER_RELATION,
  lenderCap,
  lenderName,
  lenderProblem,
  LENDERS,
  LOAN_CEILING_SHARE,
  loanCeiling,
  loanRate,
  marketRate,
  MAX_LOAN_YEARS,
  MAX_LOANS,
  MIN_LOAN,
  MISSED_RELATION,
  MISSED_REPUTATION,
  outstanding,
  validateLoan,
  validateRepay,
  type RateLine,
} from './finance/loans';
export { dailyFinance, type DailyFinance } from './finance/daily';
export { ADVICE, advise, type Advice, type AdviceTopic } from './advisor/advisor';
export {
  DEMAND_SHARES,
  EXPORT_MARGIN,
  EXPORT_PRICE,
  MAX_PLANT_ORDER,
  MAX_PLANT_QUEUE,
  OPENING_MARGIN,
  PLANT_CANCEL_REFUND,
  POLLUTION_APPROVAL,
  POLLUTION_DISASTERS,
  SHORTFALL_APPROVAL,
  SHORTFALL_GROWTH,
  type DemandSource,
} from './energy/constants';
export {
  consumption,
  demand,
  disasterFactor,
  emissionsIndex,
  exportedPower,
  exportRevenue,
  gridApprovalLines,
  plantOutput,
  plantsForMargin,
  plantsOf,
  plantUpkeep,
  powerBalance,
  production,
  productionBy,
  shortfall,
  shortfallGrowth,
} from './energy/grid';
export { plantCost, validateCancelPlant, validateDecommission, validatePlant } from './energy/build';
export {
  AGENCY_CONTENT,
  EQUIPMENT_CONTENT,
  OFFICER_CONTENT,
  POLICE_UNIT_CONTENT,
  STATION_CONTENT,
  type AgencyContent,
  type EquipmentContent,
  type PoliceUnitContent,
} from './content/police';
export {
  CIVIL_LIBERTIES,
  MAX_RECRUIT,
  MAX_STATIONS,
  MAX_UNIT_ORDER,
  OPENING_AGENCY_STRENGTH,
  POLICE_IMPACT,
  START_CRIME,
} from './police/constants';
export {
  civilLibertiesCost,
  crimeTarget,
  deployedOfficers,
  equipmentEffect,
  headcountRatio,
  officersForRatio,
  officersPer100k,
  policeRatio,
  policeUpkeep,
  stationCapacity,
  stationsNeeded,
  unitRatio,
} from './police/strength';
export {
  agencyCost,
  nextEquipment,
  recruitCost,
  stationCost,
  unitCost as policeUnitCost,
  validateAgency,
  validateEquipment,
  validateRecruit,
  validateStations,
  validateUnit,
} from './police/actions';
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
export { electionYear, ELECTION_SWING, FATIGUE_MAX_YEARS, reelectionApproval, voterFatigue } from './systems/term';
export {
  dispatch,
  policyCooldownDays,
  POLICY_CHANGE_COST,
  type Command,
  type CommandResult,
  type BudgetProposal,
} from './commands';
export { nextBudgetDate, allocationBounds, announcementEffect, validateBudget } from './commands/budget';
export {
  ALLOCATION_LIMITS,
  BUDGET_COOLDOWN_DAYS,
  DEFAULT_TAX_RATES,
  MAX_TAX_STEP,
  POPULATION_GROWTH,
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
  averageTariff,
  revenueBreakdown,
  type FiscalProjection,
  type RevenueAdditionId,
  type RevenueBreakdown,
  type RevenueFactorId,
} from './economy/model';
export { explainGrowth, GROWTH_DRIVER_LABELS, type GrowthDriver } from './economy/growth';
export {
  APPROVAL_FACTOR_LABELS,
  APPROVAL_WEIGHTS,
  IMPEACHMENT_MONTHS,
  IMPEACHMENT_THRESHOLD,
  impeachmentThreshold,
  approvalTarget,
  governanceLines,
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
export {
  MAX_PENDING,
  MAX_REPEATS,
  raiseEvent,
  recentFires,
  REPEAT_WINDOW_DAYS,
  TUTORIAL_QUIET_DAYS,
} from './events/engine';
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
export { loanInterest, nationalLeakageFactor } from './economy/model';
export { noReceipts, totalReceipts } from './finance/receipts';
export { advanceUntilAttention } from './engine/tick';
export { UNIT_CONTENT, RESEARCH_LIST, RIVAL_CONTENT, researchNode } from './content/military';
export type { UnitContent, ResearchContent, RivalContent, FrontContent } from './content/military';
export {
  DELIVERY,
  DRILLS,
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
export {
  deliveryDays,
  fundingFor,
  moraleTarget,
  orderCost,
  previewForces,
  readinessTarget,
  validateDecommissionUnits,
  validateOrder,
  type ForcePreview,
  type Funding,
} from './military/forces';
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
  relationLevel,
  RELATION_LEVELS,
  type RelationLevel,
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
export {
  eventPlace,
  fillLowest,
  homeRegion,
  placeName,
  regionalPlay,
  splitCloseIndustry,
  splitDecommission,
  splitDemolish,
  splitFacilities,
  splitOfficers,
  splitStations,
  type Share,
} from './national/split';
export {
  hottestRegion,
  nationalCrime,
  nationalCrimeTarget,
  nationalHeadcountRatio,
  nationalOfficers,
  nationalOfficersForRatio,
  nationalStations,
  nationalStationsNeeded,
  nationalPoliceRatio,
  nationalUnrest,
} from './national/view';

import type { DrillKind, IntelKind } from '../content/ids';

/** Opening values of the armed forces. */
export const START_READINESS = 70;
export const START_MORALE = 65;
export const START_DETERRENCE = 40;
export const START_COUNTER_INTEL = 40;
/** ₹ crore in the Defence procurement fund on day one, so the first orders can be placed. */
export const START_PROCUREMENT_FUND = 20_000;

/** Multipliers by technology tier. */
export const TIER_POWER: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.25, 3: 1.6 };
export const TIER_COST: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.4, 3: 1.9 };
export const TIER_UPKEEP: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.12, 3: 1.25 };

/** Converts raw unit points to the strength index (India starts near 80 at 70% readiness). */
export const POWER_SCALE = 1 / 15;

/** Ceiling on the procurement fund, in months of Defence spending. Surplus beyond it is not banked. */
export const FUND_CAP_MONTHS = 8;

export const MAX_QUEUE = 8;
export const MAX_ORDER_SIZE = 20;
/** Share of the price returned when an order is cancelled. */
export const CANCEL_REFUND = 0.6;

export const MAX_DRILLS = 2;
export const MAX_INTEL_OPS = 3;
export const MAX_REPORTS = 6;

export interface DrillSpec {
  label: string;
  summary: string;
  /** ₹ crore from the procurement fund. */
  cost: number;
  days: number;
  readiness: number;
  morale: number;
  deterrence: number;
  /** Chance a drill goes wrong, costing morale. */
  accident: number;
}

export const DRILLS: Record<DrillKind, DrillSpec> = {
  land: {
    label: 'Land exercise',
    summary: 'Divisions, armour and artillery train together on the northern plains.',
    cost: 600,
    days: 21,
    readiness: 6,
    morale: 3,
    deterrence: 2,
    accident: 0.05,
  },
  air: {
    label: 'Air exercise',
    summary: 'Fighter and strike squadrons practise air combat and deep strikes.',
    cost: 900,
    days: 21,
    readiness: 6,
    morale: 3,
    deterrence: 3,
    accident: 0.06,
  },
  naval: {
    label: 'Naval exercise',
    summary: 'Fleets and submarines drill sea control and convoy defence.',
    cost: 1_000,
    days: 30,
    readiness: 6,
    morale: 3,
    deterrence: 3,
    accident: 0.05,
  },
  joint: {
    label: 'Joint exercise',
    summary: 'All three services and the strategic forces rehearse a single campaign.',
    cost: 2_800,
    days: 45,
    readiness: 14,
    morale: 6,
    deterrence: 7,
    accident: 0.08,
  },
};

export interface IntelSpec {
  label: string;
  summary: string;
  /** ₹ crore from the treasury (the Intelligence budget). */
  cost: number;
  days: number;
  /** Extra difficulty for the operation. */
  difficulty: number;
}

export const INTEL_OPS: Record<IntelKind, IntelSpec> = {
  recon: {
    label: 'Recon',
    summary: 'Reveals the target army and its readiness. The picture goes stale as time passes.',
    cost: 800,
    days: 30,
    difficulty: 0,
  },
  sabotage: {
    label: 'Sabotage',
    summary:
      'Cripples the target’s readiness for months. Riskier: if it fails or leaves traces, there is a diplomatic incident.',
    cost: 2_500,
    days: 60,
    difficulty: 0.1,
  },
  counterIntel: {
    label: 'Counter-intelligence',
    summary: 'Hunts foreign spies for four months: rival operations against India are far more likely to be caught.',
    cost: 1_200,
    days: 120,
    difficulty: 0,
  },
};

/** Chance that a failed operation is exposed rather than quietly abandoned. */
export const EXPOSURE_ON_FAILURE = 0.55;
/** Chance a successful sabotage leaves traces that are found anyway. */
export const EXPOSURE_ON_SABOTAGE_SUCCESS = 0.12;
export const EXPOSURE_RELATION_HIT: Record<'recon' | 'sabotage', number> = { recon: 12, sabotage: 24 };

/** Days a recon picture stays sharp; the range around the estimate widens until it is fully stale. */
export const SIGHTING_STALE_DAYS = 365;

export const WAR = {
  /** Fraction of strength lost per day at an even fight. */
  lossRate: 0.003,
  /** Largest daily change of a front’s progress. */
  maxProgress: 3,
  progressGain: 1,
  /** Randomness of each side’s daily effort. */
  noise: 0.15,
  /** ₹ crore per day per point of India’s strength. */
  costPerStrength: 6,
  /** Cost to mobilise when India declares war. */
  mobilisation: 5_000,
  weariness: { perDay: 0.12, perLossPoint: 12 },
  /** Score (mean front progress) at which the enemy capitulates. */
  victoryScore: 70,
  /** Share of its starting strength below which the enemy capitulates. */
  victoryStrengthShare: 0.3,
  /** Score at which India is forced to capitulate. */
  defeatScore: -85,
  /** Days to settle after a victory before the default (reparations) applies. */
  termsDays: 30,
  /** Approval penalty (points) per 100 weariness, at most. */
  wearinessApproval: 10,
  /** Terrain bonus for the weaker, defending side. */
  terrain: { plains: 1, desert: 1.05, jungle: 1.15, mountains: 1.3, coast: 1.1 },
  /** Days before the first AI declaration of war can happen. */
  grace: 365,
} as const;

export const NUCLEAR = {
  startCost: 12_000,
  /** ₹ crore per month while the program is funded. */
  monthlyCost: 1_200,
  warheadCost: 2_000,
  researchMonths: 36,
  enrichmentMonths: 24,
  monthsPerWarhead: 4,
  maxWarheads: 24,
  /** Growth penalty (annual) from sanctions pressure once the program is visible. */
  sanctionPressure: -0.002,
  visibleAt: 40,
  /** Deterrence bonus for a declared arsenal. */
  deterrence: (warheads: number) => Math.min(30, 6 * Math.sqrt(warheads)),
} as const;

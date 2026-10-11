import type { OperationKind, RegionId } from '../content/ids';

/** Structural unrest pressure per region (distance, development, history of neglect). Regional, never communal. */
export const REGION_UNREST_BIAS: Record<RegionId, number> = {
  north: 0,
  south: -3,
  east: 3,
  west: -2,
  central: 2,
  northEast: 4,
};

export const START_UNREST = 22;
export const START_TERROR_THREAT = 28;
export const START_BORDER_TENSION = 30;
export const START_MILITARY_LOYALTY = 67;

/** Unrest at or above this is a riot: regional riot events become eligible. */
export const RIOT_UNREST = 65;
/**
 * With the "no riots" option, unrest is held at this level: below the riot level and below RIOT_TRIGGER (60),
 * the unrest every riot event needs (content tests check that no riot event can fire beneath it).
 */
export const NO_RIOTS_UNREST_CAP = 58;
/** Unrest at or above this counts as "tense" in the UI. */
export const TENSE_UNREST = 45;

/** Public debt (share of GDP) above which the country is insolvent. */
export const BANKRUPTCY_DEBT_RATIO = 1.2;
/** Consecutive monthly settlements above the threshold that end the presidency. */
export const BANKRUPTCY_MONTHS = 12;

/** Coup risk (0–100) above which the generals are restless and a coup can happen. */
export const COUP_RISK_THRESHOLD = 55;

export const MAX_INVESTIGATIONS = 2;
export const INVESTIGATION_COST = 1_500;
export const INVESTIGATION_DAYS = 60;

export interface OperationSpec {
  label: string;
  summary: string;
  /** ₹ crore, paid on launch. */
  cost: number;
  /** Days the operation runs (a raid is instant, but cannot be repeated for this long). */
  days: number;
}

export const OPERATIONS: Record<OperationKind, OperationSpec> = {
  raid: {
    label: 'Launch a raid',
    summary:
      'Strike suspected cells now. Cuts the terror threat and may stop a live plot, but a botched raid costs approval and stirs unrest.',
    cost: 1_200,
    days: 30,
  },
  surveillance: {
    label: 'Expand surveillance',
    summary:
      'Slow and quiet: for four months the threat falls, intelligence catches more plots and live plots are harder to carry out.',
    cost: 600,
    days: 120,
  },
  borderSeal: {
    label: 'Seal the border',
    summary:
      'Shut crossings for two months. Sharply cuts the threat and blunts live plots, but trade and growth suffer.',
    cost: 1_500,
    days: 60,
  },
};

/** Growth penalty while the border is sealed (annual real growth). */
export const BORDER_SEAL_GROWTH = -0.003;

import type { IdeologyId, SectorId } from '../content/ids';

/** US$ billion → ₹ crore at the opening exchange rate (₹83 to the dollar). */
export const USD_BN_TO_CRORE = 8_300;

export const START_REPUTATION = 60;
export const REPUTATION_DRIFT = 0.04;
/** Reputation never settles above this, however many deals are signed. */
export const REPUTATION_CEILING = 75;

/** How far each relation moves toward its target every month. */
export const RELATION_DRIFT = 0.08;
export const INCIDENT_DECAY = 0.88;

/** How alike two outlooks are, −1 (opposed) … +1 (the same). Symmetric. */
const MATCH: Record<IdeologyId, Record<IdeologyId, number>> = {
  liberalism: { liberalism: 1, socialism: -0.2, conservatism: 0.2, nationalism: -0.3, technocracy: 0.5 },
  socialism: { liberalism: -0.2, socialism: 1, conservatism: -0.5, nationalism: 0, technocracy: 0.1 },
  conservatism: { liberalism: 0.2, socialism: -0.5, conservatism: 1, nationalism: 0.4, technocracy: 0 },
  nationalism: { liberalism: -0.3, socialism: 0, conservatism: 0.4, nationalism: 1, technocracy: 0.1 },
  technocracy: { liberalism: 0.5, socialism: 0.1, conservatism: 0, nationalism: 0.1, technocracy: 1 },
};
export const ideologyMatch = (a: IdeologyId, b: IdeologyId): number => MATCH[a][b];

/** Weights of the relation target (points on the −100…+100 scale). */
export const RELATION_WEIGHTS = {
  ideology: 10,
  perTrade: 4,
  maxTrade: 12,
  embassy: 5,
  pact: 8,
  /** India has sanctioned them. */
  sanctions: -30,
  /** They have sanctioned India. */
  sanctioning: -15,
  /** Per point of reputation above or below 55. */
  reputation: 0.25,
  incidents: -0.45,
  war: -60,
  /** Per point of world tension. */
  tension: -0.06,
} as const;
export const NEUTRAL_REPUTATION = 55;

export const MAX_TRADE_TREATIES = 6;
export const MAX_OFFERS = 4;
export const OFFER_DAYS = 90;
/** Days before a refused proposal can be repeated. */
export const PROPOSAL_COOLDOWN = 60;

export const TRADE_YEARS = [1, 3, 5] as const;
export const PACT_YEARS = 5;

/** Trade contract sizes as a share of India’s annual GDP. */
export const TRADE_SIZES = {
  small: { label: 'Small', gdpShare: 0.0015 },
  medium: { label: 'Medium', gdpShare: 0.004 },
  large: { label: 'Large', gdpShare: 0.009 },
} as const;
export type TradeSize = keyof typeof TRADE_SIZES;
/** A contract cannot exceed this share of the partner’s own GDP. */
export const PARTNER_GDP_CAP = 0.03;
/** Sector growth (annual) added per unit of GDP share of the contract. */
export const TRADE_GROWTH_PER_GDP = 1.0;
/** Share of a contract’s value that lands as customs revenue. */
export const TRADE_CUSTOMS_YIELD = 0.12;
/** Extra effect when the partner is strong in the contract’s sector. */
export const COMPLEMENT_BONUS = 1.25;
/** Relation gained on signing a trade contract, a pact, an embassy. */
export const SIGN_RELATION = { trade: 6, nonAggression: 10, embassy: 8 } as const;

export const EMBASSY = { cost: 400, monthly: 15 } as const;

export const AID = {
  small: { label: 'Small package', cost: 300, relation: 6, reputation: 0.5 },
  medium: { label: 'Medium package', cost: 1_500, relation: 12, reputation: 1.5 },
  large: { label: 'Large package', cost: 5_000, relation: 20, reputation: 3 },
} as const;
export type AidSize = keyof typeof AID;
export const AID_COOLDOWN = 120;

export const SANCTIONS = {
  relation: -25,
  /** Reputation lost for sanctioning a country that has done nothing to deserve it. */
  reputation: -3,
  /** Relation above which sanctions look unprovoked. */
  provokedBelow: -30,
  /** Customs revenue lost per point of the target’s power (as a fraction of customs). */
  customsPerPower: 0.0008,
} as const;

export const BREAK_PENALTY = {
  trade: { reputation: 6, relation: 15 },
  nonAggression: { reputation: 14, relation: 30 },
  embassy: { reputation: 0, relation: 5 },
  sanctions: { reputation: 0, relation: 0 },
} as const;

/** A pact keeps a country from attacking India. */
export const SECTOR_LABELS: Record<SectorId, string> = {
  agriculture: 'Agriculture',
  industry: 'Industry',
  services: 'Services',
  energy: 'Energy',
  tech: 'Technology',
};

/** The focus AI: how many months pass between its actions, and utility weights. */
export const AI = {
  /** Chance a focus nation acts in a given month (it evaluates every month, acts some of them). */
  actionRate: 0.22,
  noise: 0.15,
  idle: 0.3,
  offer: { relation: 0.9, ideology: 0.3, balance: 0.15, base: -0.35 },
  pact: { relation: 0.8, ideology: 0.3, weakness: 0.25, deterrence: 0.2, base: -0.4 },
  threaten: { hostility: 0.9, aggression: 0.55, power: 0.4, deterrence: -0.6, base: -0.15 },
  sanction: { hostility: 0.9, aggression: 0.3, power: 0.4, deterrence: -0.4, base: -0.35 },
  war: { hostility: 1.0, aggression: 0.6, power: 0.5, deterrence: -0.9, ideology: -0.3, base: -0.05 },
  /** A focus nation with this relation or better will not threaten India. */
  threatenBelow: 10,
  sanctionPowerMin: 40,
  sanctionDays: 365,
  sanctionGrowth: -0.0025,
  /** Pending-offer limit per country. */
  threatRelation: -4,
} as const;

export const WORLD = {
  tensionDecay: 0.06,
  /** Monthly chance a non-focus country has an incident with India. */
  incidentChance: 0.025,
  /** Largest number of notable non-focus incidents written to the inbox per month. */
  maxIncidentLogs: 2,
  conflictTension: 8,
} as const;

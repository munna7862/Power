import { SECTORS, type CountryId, type SectorId, type TreatyType } from '../content/ids';
import { COUNTRY_CONTENT } from '../content/world';
import { nominalGdp } from '../economy/model';
import type { Rng } from '../engine/rng';
import { addModifier } from '../politics/policy';
import { clamp } from '../security/unrest';
import { appendLog } from '../state/log';
import { INDIA, type GameState, type Offer, type TradeTerms, type Treaty } from '../state/types';
import {
  AID,
  AID_COOLDOWN,
  BREAK_PENALTY,
  COMPLEMENT_BONUS,
  EMBASSY,
  ideologyMatch,
  MAX_TRADE_TREATIES,
  PACT_YEARS,
  PARTNER_GDP_CAP,
  PROPOSAL_COOLDOWN,
  SANCTIONS,
  SIGN_RELATION,
  TRADE_CUSTOMS_YIELD,
  TRADE_GROWTH_PER_GDP,
  TRADE_SIZES,
  TRADE_YEARS,
  USD_BN_TO_CRORE,
  type AidSize,
  type TradeSize,
} from './constants';
import {
  addIncident,
  adjustRelation,
  atWarWithCountry,
  countryState,
  hasTreaty,
  patchCountry,
  relationOf,
  treatiesWith,
} from './relations';

const DAYS_PER_YEAR = 365;
const name = (id: CountryId) => COUNTRY_CONTENT[id]?.name ?? id;
const crore = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')} crore`;

export const adjustReputation = (state: GameState, delta: number): GameState => ({
  ...state,
  diplomacy: {
    ...state.diplomacy,
    reputation: clamp(state.diplomacy.reputation + delta, 0, 100),
  },
});

/** The country on the other side of a treaty with India. */
export const partnerOf = (t: Treaty): CountryId => (t.parties[0] === INDIA ? t.parties[1] : t.parties[0]);

export const activeTrade = (state: GameState): Treaty[] => state.diplomacy.treaties.filter((t) => t.type === 'trade');

// --- Trade contracts -------------------------------------------------------------------------------------

/** Annual value (₹ crore) of a contract of the given size, rounded to ₹100 crore. */
export const tradeValue = (state: GameState, size: TradeSize): number =>
  Math.round((nominalGdp(state.economy) * TRADE_SIZES[size].gdpShare) / 100) * 100;

/** The largest contract the partner can take: a small share of its own economy. */
export const tradeCap = (id: CountryId): number => (COUNTRY_CONTENT[id]?.gdp ?? 0) * USD_BN_TO_CRORE * PARTNER_GDP_CAP;

export function tradeSizesFor(state: GameState, id: CountryId): { size: TradeSize; value: number }[] {
  return (Object.keys(TRADE_SIZES) as TradeSize[])
    .map((size) => ({ size, value: tradeValue(state, size) }))
    .filter((o) => o.value <= tradeCap(id));
}

export interface TradeEffect {
  /** Annual growth added to the contract’s sector. */
  growth: number;
  /** Customs revenue added, as a fraction. */
  customs: number;
}

/** What a contract does for the economy: sector growth and customs revenue, from its share of GDP. */
export function tradeEffect(state: GameState, id: CountryId, sector: SectorId, value: number): TradeEffect {
  const share = value / nominalGdp(state.economy);
  const complement = COUNTRY_CONTENT[id]?.strengths.includes(sector) ? COMPLEMENT_BONUS : 1;
  const customsBase = nominalGdp(state.economy) * 0.0727 * state.budget.taxRates.customs;
  return {
    growth: share * TRADE_GROWTH_PER_GDP * complement,
    customs: (value * TRADE_CUSTOMS_YIELD) / Math.max(1, customsBase),
  };
}

export interface AcceptanceLine {
  label: string;
  value: number;
}

/** Odds that a country agrees to a trade contract, with the terms that make them. Shared by the UI and the roll. */
export function tradeAcceptance(
  state: GameState,
  id: CountryId,
  sector: SectorId,
  value: number,
): { chance: number; lines: AcceptanceLine[] } {
  const c = COUNTRY_CONTENT[id];
  if (!c) return { chance: 0, lines: [] };
  const cs = countryState(state, id);
  const lines: AcceptanceLine[] = [
    { label: 'Base', value: 0.45 },
    { label: 'Relation', value: cs.relation / 120 },
    { label: 'Ideology match', value: 0.12 * ideologyMatch(c.outlook, state.politics.ideology) },
    { label: 'Strong in this sector', value: c.strengths.includes(sector) ? 0.08 : 0 },
    { label: 'Embassy', value: cs.embassy ? 0.08 : 0 },
    { label: 'Reputation', value: (state.diplomacy.reputation - 55) / 250 },
    { label: 'Size of deal', value: -0.5 * (value / Math.max(1, tradeCap(id))) },
  ];
  const blocked = cs.sanctioned || atWarWithCountry(state, id) || cs.relation < -30;
  const chance = blocked
    ? 0
    : clamp(
        lines.reduce((s, l) => s + l.value, 0),
        0.03,
        0.95,
      );
  return { chance, lines };
}

export function pactAcceptance(state: GameState, id: CountryId): { chance: number; lines: AcceptanceLine[] } {
  const c = COUNTRY_CONTENT[id];
  if (!c) return { chance: 0, lines: [] };
  const cs = countryState(state, id);
  const lines: AcceptanceLine[] = [
    { label: 'Base', value: 0.2 },
    { label: 'Relation', value: cs.relation / 100 },
    { label: 'Ideology match', value: 0.1 * ideologyMatch(c.outlook, state.politics.ideology) },
    { label: 'Embassy', value: cs.embassy ? 0.1 : 0 },
    { label: 'Reputation', value: (state.diplomacy.reputation - 55) / 250 },
    { label: 'Its aggression', value: -c.aggression / 250 },
  ];
  const blocked = cs.sanctioned || atWarWithCountry(state, id) || cs.relation < -20;
  const chance = blocked
    ? 0
    : clamp(
        lines.reduce((s, l) => s + l.value, 0),
        0.03,
        0.9,
      );
  return { chance, lines };
}

// --- Validation -------------------------------------------------------------------------------------------

const known = (id: CountryId): string | null => (COUNTRY_CONTENT[id] ? null : `Unknown country ${id}.`);

function validateProposal(state: GameState, id: CountryId): string | null {
  const unknown = known(id);
  if (unknown) return unknown;
  const cs = countryState(state, id);
  if (atWarWithCountry(state, id)) return `You are at war with ${name(id)}.`;
  if (cs.sanctioned) return `You have sanctioned ${name(id)}; lift the sanctions first.`;
  if (cs.proposalReadyTick > state.clock.tick) {
    return `${name(id)} has not forgotten the last refusal. Try again in ${cs.proposalReadyTick - state.clock.tick} days.`;
  }
  return null;
}

export function validateTrade(
  state: GameState,
  id: CountryId,
  sector: SectorId,
  size: TradeSize,
  years: number,
): string | null {
  const problem = validateProposal(state, id);
  if (problem) return problem;
  if (!SECTORS.includes(sector)) return `Unknown sector ${sector}.`;
  if (!(size in TRADE_SIZES)) return `Unknown contract size ${size}.`;
  if (!(TRADE_YEARS as readonly number[]).includes(years)) return 'Contracts run for 1, 3 or 5 years.';
  if (!tradeSizesFor(state, id).some((o) => o.size === size)) {
    return `${name(id)}’s economy is too small for that contract.`;
  }
  if (activeTrade(state).length >= MAX_TRADE_TREATIES) {
    return `You can hold at most ${MAX_TRADE_TREATIES} trade contracts.`;
  }
  if (activeTrade(state).some((t) => partnerOf(t) === id && t.terms.sector === sector)) {
    return `You already have a ${sector} contract with ${name(id)}.`;
  }
  return null;
}

export function validatePact(state: GameState, id: CountryId): string | null {
  const problem = validateProposal(state, id);
  if (problem) return problem;
  if (hasTreaty(state, id, 'nonAggression')) return `You already have a pact with ${name(id)}.`;
  return null;
}

export function validateEmbassy(state: GameState, id: CountryId): string | null {
  const unknown = known(id);
  if (unknown) return unknown;
  const cs = countryState(state, id);
  if (cs.embassy) return `You already have an embassy in ${name(id)}.`;
  if (atWarWithCountry(state, id)) return `You are at war with ${name(id)}.`;
  if (cs.sanctioned) return `You have sanctioned ${name(id)}.`;
  if (cs.relation < -50) return `${name(id)} will not receive an embassy while relations are this poor.`;
  if (state.nation.treasury < EMBASSY.cost) return 'The treasury cannot cover the cost of an embassy.';
  return null;
}

export function validateAid(state: GameState, id: CountryId, size: AidSize): string | null {
  const unknown = known(id);
  if (unknown) return unknown;
  if (!(size in AID)) return `Unknown aid package ${size}.`;
  if (atWarWithCountry(state, id)) return `You are at war with ${name(id)}.`;
  if (countryState(state, id).aidReadyTick > state.clock.tick) return `${name(id)} has received aid recently.`;
  if (state.nation.treasury < AID[size].cost) return 'The treasury cannot cover that package.';
  return null;
}

export function validateSanctions(state: GameState, id: CountryId): string | null {
  const unknown = known(id);
  if (unknown) return unknown;
  if (countryState(state, id).sanctioned) return `${name(id)} is already under sanctions.`;
  return null;
}

export function validateLift(state: GameState, id: CountryId): string | null {
  const unknown = known(id);
  if (unknown) return unknown;
  return countryState(state, id).sanctioned ? null : `${name(id)} is not under sanctions.`;
}

export function validateBreak(state: GameState, treatyId: string): string | null {
  const t = state.diplomacy.treaties.find((x) => x.id === treatyId);
  if (!t) return 'That treaty no longer exists.';
  if (t.parties[0] !== INDIA) return 'India cannot cancel measures imposed by others.';
  if (t.type === 'sanctions') return 'Lift the sanctions instead.';
  return null;
}

// --- Signing and ending -----------------------------------------------------------------------------------

export interface NewTreaty {
  type: TreatyType;
  parties: [CountryId, CountryId];
  years: number | null;
  terms?: Partial<TradeTerms>;
}

/**
 * Signs a treaty or measure. The single path for the player’s proposals, accepted offers and the AI’s
 * measures, so none of them can get a deal the others could not.
 */
export function signTreaty(state: GameState, spec: NewTreaty): GameState {
  const id = `trt-${state.nextId}`;
  const endTick = spec.years === null ? null : state.clock.tick + spec.years * DAYS_PER_YEAR;
  const treaty: Treaty = {
    id,
    type: spec.type,
    parties: spec.parties,
    startTick: state.clock.tick,
    endTick,
    terms: spec.terms ?? {},
  };
  let next: GameState = {
    ...state,
    diplomacy: { ...state.diplomacy, treaties: [...state.diplomacy.treaties, treaty] },
    nextId: state.nextId + 1,
  };
  const partner = spec.parties[0] === INDIA ? spec.parties[1] : spec.parties[0];
  const days = spec.years === null ? null : spec.years * DAYS_PER_YEAR;

  if (spec.type === 'trade' && spec.terms?.sector && spec.terms.value) {
    const effect = tradeEffect(next, partner, spec.terms.sector, spec.terms.value);
    next = addModifier(
      next,
      {
        source: `treaty-${id}`,
        label: `Trade with ${name(partner)}`,
        target: `economy.growth.${spec.terms.sector}`,
        kind: 'add',
        value: effect.growth,
      },
      days,
    );
    next = addModifier(
      next,
      {
        source: `treaty-${id}`,
        label: `Trade with ${name(partner)}`,
        target: 'economy.customs',
        kind: 'mult',
        value: effect.customs,
      },
      days,
    );
    next = adjustRelation(next, partner, SIGN_RELATION.trade);
  } else if (spec.type === 'nonAggression') {
    next = adjustRelation(next, partner, SIGN_RELATION.nonAggression);
  } else if (spec.type === 'embassy') {
    next = patchCountry(next, partner, { embassy: true });
    next = adjustRelation(next, partner, SIGN_RELATION.embassy);
  } else if (spec.type === 'sanctions') {
    if (spec.parties[0] === INDIA) {
      next = patchCountry(next, partner, { sanctioned: true });
      const power = COUNTRY_CONTENT[partner]?.power ?? 20;
      next = addModifier(
        next,
        {
          source: `treaty-${id}`,
          label: `Sanctions on ${name(partner)}`,
          target: 'economy.customs',
          kind: 'mult',
          value: -SANCTIONS.customsPerPower * power,
        },
        days,
      );
    } else {
      next = addModifier(
        next,
        {
          source: `treaty-${id}`,
          label: `Sanctions by ${name(partner)}`,
          target: 'economy.growth',
          kind: 'add',
          value: -0.0025,
        },
        days,
      );
    }
  }
  return next;
}

/** Removes a treaty and everything it granted. Does not apply penalties; see breakTreaty. */
export function endTreaty(state: GameState, treatyId: string): GameState {
  const t = state.diplomacy.treaties.find((x) => x.id === treatyId);
  if (!t) return state;
  let next: GameState = {
    ...state,
    diplomacy: { ...state.diplomacy, treaties: state.diplomacy.treaties.filter((x) => x.id !== treatyId) },
    modifiers: state.modifiers.filter((m) => m.source !== `treaty-${treatyId}`),
  };
  const partner = partnerOf(t);
  if (t.type === 'embassy') next = patchCountry(next, partner, { embassy: false });
  if (t.type === 'sanctions' && t.parties[0] === INDIA) next = patchCountry(next, partner, { sanctioned: false });
  return next;
}

/** India ends a treaty early: the other side and the world remember. */
export function breakTreaty(state: GameState, treatyId: string): GameState {
  const t = state.diplomacy.treaties.find((x) => x.id === treatyId);
  if (!t) return state;
  const partner = partnerOf(t);
  const penalty = BREAK_PENALTY[t.type];
  let next = endTreaty(state, treatyId);
  next = adjustRelation(next, partner, -penalty.relation);
  if (penalty.relation >= 15) next = addIncident(next, partner, penalty.relation / 2);
  if (penalty.reputation > 0) next = adjustReputation(next, -penalty.reputation);
  const label = t.type === 'nonAggression' ? 'non-aggression pact' : t.type === 'trade' ? 'trade contract' : 'embassy';
  return appendLog(next, {
    severity: penalty.reputation > 0 ? 'warning' : 'info',
    category: 'diplomacy',
    title: `Ended the ${label} with ${name(partner)}`,
    body:
      penalty.reputation > 0
        ? `${name(partner)} protested and other capitals took note: India’s reputation as a reliable partner falls by ${penalty.reputation} points.`
        : `The ${label} with ${name(partner)} has been closed.`,
  });
}

/** Breaks every treaty with a country that a declaration of war tears up. */
export function breakTreatiesForWar(state: GameState, id: CountryId): GameState {
  let next = state;
  for (const t of treatiesWith(state, id)) {
    if (t.parties[0] !== INDIA || t.type === 'sanctions') continue;
    next = breakTreaty(next, t.id);
  }
  return next;
}

// --- Player actions -----------------------------------------------------------------------------------------

export function proposeTrade(
  state: GameState,
  rng: Rng,
  id: CountryId,
  sector: SectorId,
  size: TradeSize,
  years: number,
): GameState {
  const value = tradeValue(state, size);
  const { chance } = tradeAcceptance(state, id, sector, value);
  if (rng.chance(chance)) {
    const next = signTreaty(state, { type: 'trade', parties: [INDIA, id], years, terms: { sector, value } });
    return appendLog(next, {
      severity: 'good',
      category: 'diplomacy',
      title: `Trade contract signed with ${name(id)}`,
      body: `A ${years}-year ${sector} contract worth ${crore(value)} a year was agreed. It adds customs revenue and sector growth, and warms relations.`,
    });
  }
  const next = patchCountry(state, id, { proposalReadyTick: state.clock.tick + PROPOSAL_COOLDOWN });
  return appendLog(adjustRelation(next, id, -1), {
    severity: 'info',
    category: 'diplomacy',
    title: `${name(id)} declines a trade contract`,
    body: `${name(id)} turned down the ${sector} proposal. Better relations, an embassy and a smaller deal improve the odds next time.`,
  });
}

export function proposePact(state: GameState, rng: Rng, id: CountryId): GameState {
  const { chance } = pactAcceptance(state, id);
  if (rng.chance(chance)) {
    const next = signTreaty(state, { type: 'nonAggression', parties: [INDIA, id], years: PACT_YEARS });
    return appendLog(next, {
      severity: 'good',
      category: 'diplomacy',
      title: `Non-aggression pact with ${name(id)}`,
      body: `${name(id)} will not attack India for ${PACT_YEARS} years. Breaking the pact would cost India dearly in reputation.`,
    });
  }
  const next = patchCountry(state, id, { proposalReadyTick: state.clock.tick + PROPOSAL_COOLDOWN });
  return appendLog(adjustRelation(next, id, -1), {
    severity: 'info',
    category: 'diplomacy',
    title: `${name(id)} declines a pact`,
    body: `${name(id)} is not ready to commit to a non-aggression pact. Warmer relations or an embassy may change that.`,
  });
}

export function openEmbassy(state: GameState, id: CountryId): GameState {
  let next: GameState = { ...state, nation: { ...state.nation, treasury: state.nation.treasury - EMBASSY.cost } };
  next = signTreaty(next, { type: 'embassy', parties: [INDIA, id], years: null });
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: `Embassy opened in ${name(id)}`,
    body: `A permanent mission now works in ${name(id)} (₹${EMBASSY.monthly} crore a month). Relations improve and proposals are likelier to succeed.`,
  });
}

export function sendAid(state: GameState, id: CountryId, size: AidSize): GameState {
  const pack = AID[size];
  const content = COUNTRY_CONTENT[id];
  // Smaller economies are more grateful for the same package.
  const gratitude = content ? clamp(1.4 - (content.gdp / 2000) ** 0.5, 0.6, 1.4) : 1;
  let next: GameState = { ...state, nation: { ...state.nation, treasury: state.nation.treasury - pack.cost } };
  next = adjustRelation(next, id, pack.relation * gratitude);
  next = patchCountry(next, id, { aidReadyTick: state.clock.tick + AID_COOLDOWN });
  next = adjustReputation(next, pack.reputation);
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: `Aid sent to ${name(id)}`,
    body: `A ${pack.label.toLowerCase()} (${crore(pack.cost)}) was welcomed in ${name(id)}. Relations improve and India’s reputation rises.`,
  });
}

export function imposeSanctions(state: GameState, id: CountryId): GameState {
  const provoked = relationOf(state, id) < SANCTIONS.provokedBelow;
  let next = signTreaty(state, { type: 'sanctions', parties: [INDIA, id], years: null });
  // Existing trade with the country ends; sanctions are not a half measure.
  for (const t of treatiesWith(next, id, 'trade')) next = endTreaty(next, t.id);
  next = adjustRelation(next, id, SANCTIONS.relation);
  next = addIncident(next, id, 20);
  if (!provoked) next = adjustReputation(next, SANCTIONS.reputation);
  return appendLog(next, {
    severity: 'warning',
    category: 'diplomacy',
    title: `Sanctions imposed on ${name(id)}`,
    body: provoked
      ? `Trade with ${name(id)} is cut off. Given the state of relations, few capitals object.`
      : `Trade with ${name(id)} is cut off and its contracts end. Several capitals see the move as unprovoked, which costs India some reputation.`,
  });
}

export function liftSanctions(state: GameState, id: CountryId): GameState {
  let next = state;
  for (const t of treatiesWith(state, id, 'sanctions')) {
    if (t.parties[0] === INDIA) next = endTreaty(next, t.id);
  }
  next = patchCountry(next, id, { sanctioned: false });
  next = adjustRelation(next, id, 10);
  return appendLog(next, {
    severity: 'info',
    category: 'diplomacy',
    title: `Sanctions on ${name(id)} lifted`,
    body: `Trade channels with ${name(id)} reopen and relations begin to recover.`,
  });
}

// --- Offers from other countries -------------------------------------------------------------------------

export function validateOffer(state: GameState, offerId: string): string | null {
  const offer = state.diplomacy.offers.find((o) => o.id === offerId);
  if (!offer) return 'That offer has lapsed.';
  if (offer.type === 'trade' && activeTrade(state).length >= MAX_TRADE_TREATIES) {
    return `You can hold at most ${MAX_TRADE_TREATIES} trade contracts.`;
  }
  if (offer.type === 'nonAggression' && hasTreaty(state, offer.from, 'nonAggression')) {
    return 'You already have a pact with that country.';
  }
  return null;
}

export function acceptOffer(state: GameState, offerId: string): GameState {
  const offer = state.diplomacy.offers.find((o) => o.id === offerId);
  if (!offer) return state;
  let next: GameState = {
    ...state,
    diplomacy: { ...state.diplomacy, offers: state.diplomacy.offers.filter((o) => o.id !== offerId) },
  };
  next = signTreaty(next, {
    type: offer.type,
    parties: [INDIA, offer.from],
    years: offer.years,
    terms: offer.terms,
  });
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: `${offer.type === 'trade' ? 'Trade contract' : 'Non-aggression pact'} with ${name(offer.from)} agreed`,
    body: `You accepted ${name(offer.from)}’s proposal. It runs for ${offer.years} year${offer.years === 1 ? '' : 's'}.`,
  });
}

export function declineOffer(state: GameState, offerId: string): GameState {
  const offer = state.diplomacy.offers.find((o) => o.id === offerId);
  if (!offer) return state;
  const next: GameState = {
    ...state,
    diplomacy: { ...state.diplomacy, offers: state.diplomacy.offers.filter((o) => o.id !== offerId) },
  };
  return adjustRelation(next, offer.from, -2);
}

export const describeOffer = (offer: Offer): string =>
  offer.type === 'trade'
    ? `${offer.terms.sector} contract, ${crore(offer.terms.value ?? 0)} a year`
    : 'non-aggression pact';

import type { CountryId, SectorId } from '../content/ids';
import { RIVALS } from '../content/ids';
import { COUNTRY_CONTENT, FOCUS_IDS, type CountryContent } from '../content/world';
import { groupIndian } from '../engine/numberFormat';
import type { Rng } from '../engine/rng';
import { declarationChance } from '../military/rivals';
import { MAX_WARS, startWar } from '../military/war';
import { clamp } from '../security/unrest';
import { appendLog } from '../state/log';
import { AI_ACTIONS, INDIA, type AiAction, type AiDecision, type GameState, type Offer } from '../state/types';
import { AI, ideologyMatch, MAX_OFFERS, MAX_TRADE_TREATIES, OFFER_DAYS, PACT_YEARS } from './constants';
import {
  addIncident,
  adjustRelation,
  atWarWithCountry as atWarWith,
  countryState,
  hasTreaty,
  indiaPower,
  sanctionsIndia,
} from './relations';
import { activeTrade, signTreaty, tradeSizesFor, tradeValue } from './treaties';

export type Utilities = Record<AiAction, number>;
/** Marks an action the nation cannot take right now. Finite, so it survives a save. */
export const UNAVAILABLE = -9;

export interface AiScoring {
  utilities: Utilities;
  inputs: AiDecision['inputs'];
}

/**
 * Utility of each action for a focus nation: a weighted sum of its relation with India, the power ratio,
 * ideology match and India’s deterrence, plus noise. The same inputs feed the debug overlay, so what it
 * shows is exactly what the AI weighed.
 */
export function scoreActions(state: GameState, id: CountryId, noise: number): AiScoring {
  const content = COUNTRY_CONTENT[id] as CountryContent;
  const cs = countryState(state, id);
  const relation = cs.relation / 100;
  const hostility = -relation;
  const powerRatio = clamp(Math.log2(Math.max(content.power, 1) / indiaPower(state)), -2, 2) / 2;
  const ideology = ideologyMatch(content.outlook, state.politics.ideology);
  const deterrence = state.military.deterrence / 100;
  const aggression = content.aggression / 100;
  const tension = state.diplomacy.worldTension / 100;
  const hasPact = hasTreaty(state, id, 'nonAggression');
  const offersFrom = state.diplomacy.offers.filter((o) => o.from === id).length;

  const w = AI;
  const u = {} as Utilities;
  const canOffer =
    cs.relation > 5 &&
    !cs.sanctioned &&
    offersFrom === 0 &&
    state.diplomacy.offers.length < MAX_OFFERS &&
    activeTrade(state).length < MAX_TRADE_TREATIES &&
    tradeSizesFor(state, id).length > 0 &&
    !atWarWith(state, id);
  u.offerDeal = canOffer
    ? w.offer.base +
      w.offer.relation * relation +
      w.offer.ideology * ideology +
      w.offer.balance * (1 - Math.abs(powerRatio)) +
      noise
    : UNAVAILABLE;
  const canPact =
    cs.relation > 15 &&
    !hasPact &&
    !cs.sanctioned &&
    offersFrom === 0 &&
    state.diplomacy.offers.length < MAX_OFFERS &&
    !atWarWith(state, id);
  u.seekPact = canPact
    ? w.pact.base +
      w.pact.relation * relation +
      w.pact.ideology * ideology -
      w.pact.weakness * powerRatio +
      w.pact.deterrence * deterrence +
      noise
    : UNAVAILABLE;
  const canThreaten = cs.relation < w.threatenBelow && !hasPact && !atWarWith(state, id);
  u.threaten = canThreaten
    ? w.threaten.base +
      w.threaten.hostility * hostility +
      w.threaten.aggression * aggression +
      w.threaten.power * powerRatio +
      w.threaten.deterrence * deterrence +
      0.3 * tension +
      noise
    : UNAVAILABLE;
  const canSanction =
    content.power >= w.sanctionPowerMin &&
    cs.relation < -25 &&
    !hasPact &&
    !sanctionsIndia(state, id) &&
    !atWarWith(state, id);
  u.sanction = canSanction
    ? w.sanction.base +
      w.sanction.hostility * hostility +
      w.sanction.aggression * aggression +
      w.sanction.power * powerRatio +
      w.sanction.deterrence * deterrence +
      noise
    : UNAVAILABLE;
  const canWar =
    (RIVALS as readonly string[]).includes(id) &&
    !hasPact &&
    !atWarWith(state, id) &&
    state.military.wars.length < MAX_WARS &&
    !state.military.rivals[id as keyof typeof state.military.rivals]?.annexed;
  u.declareWar = canWar
    ? w.war.base +
      w.war.hostility * hostility +
      w.war.aggression * aggression +
      w.war.power * powerRatio +
      w.war.deterrence * deterrence +
      w.war.ideology * ideology +
      noise
    : UNAVAILABLE;
  u.idle = w.idle;
  return { utilities: u, inputs: { relation, powerRatio, ideology, deterrence, noise } };
}

/** The action a nation prefers: the highest utility (ties go to idle, then the order of AI_ACTIONS). */
export function bestAction(utilities: Utilities): AiAction {
  let best: AiAction = 'idle';
  for (const a of AI_ACTIONS) if (utilities[a] > utilities[best]) best = a;
  return best;
}

const name = (id: CountryId) => COUNTRY_CONTENT[id]?.name ?? id;

/** Executes an AI action through the same functions the player’s commands use. */
export function performAction(state: GameState, id: CountryId, action: AiAction, rng: Rng): GameState {
  const content = COUNTRY_CONTENT[id] as CountryContent;
  switch (action) {
    case 'offerDeal': {
      const sizes = tradeSizesFor(state, id);
      const pick = sizes[Math.min(sizes.length - 1, 1)];
      if (!pick) return state;
      const sector = content.strengths[Math.floor(rng.next() * content.strengths.length)] as SectorId;
      return raiseOffer(state, id, 'trade', 3, { sector, value: tradeValue(state, pick.size) });
    }
    case 'seekPact':
      return raiseOffer(state, id, 'nonAggression', PACT_YEARS, {});
    case 'threaten': {
      let next = adjustRelation(state, id, AI.threatRelation);
      next = addIncident(next, id, 8);
      if (content.neighbour) {
        next = {
          ...next,
          security: { ...next.security, borderTension: clamp(next.security.borderTension + 3, 0, 100) },
        };
      }
      return appendLog(next, {
        severity: 'warning',
        category: 'diplomacy',
        title: `${name(id)} issues a warning to India`,
        body: `${name(id)}’s government has made pointed statements about India’s conduct. A strong, visible military makes such talk less likely.`,
      });
    }
    case 'sanction': {
      let next = signTreaty(state, { type: 'sanctions', parties: [id, INDIA], years: 1 });
      next = addIncident(next, id, 6);
      return appendLog(next, {
        severity: 'critical',
        category: 'diplomacy',
        title: `${name(id)} imposes sanctions on India`,
        body: `${name(id)} has restricted trade with India for a year. Growth will suffer until relations improve and the measures lapse.`,
      });
    }
    case 'declareWar':
      return startWar(state, id as Parameters<typeof startWar>[1], 'rival');
    case 'idle':
      return state;
  }
}

function raiseOffer(
  state: GameState,
  id: CountryId,
  type: Offer['type'],
  years: number,
  terms: Offer['terms'],
): GameState {
  const offer: Offer = {
    id: `ofr-${state.nextId}`,
    from: id,
    type,
    years,
    terms,
    raisedTick: state.clock.tick,
    expiresTick: state.clock.tick + OFFER_DAYS,
  };
  const next: GameState = {
    ...state,
    diplomacy: { ...state.diplomacy, offers: [...state.diplomacy.offers, offer] },
    nextId: state.nextId + 1,
  };
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: type === 'trade' ? `${name(id)} proposes a trade contract` : `${name(id)} proposes a non-aggression pact`,
    body:
      type === 'trade'
        ? `${name(id)} offers a ${years}-year ${terms.sector} contract worth ₹${groupIndian(terms.value ?? 0)} crore a year. Answer on the Diplomacy screen within ${OFFER_DAYS} days.`
        : `${name(id)} proposes that neither country attacks the other for ${years} years. Answer on the Diplomacy screen within ${OFFER_DAYS} days.`,
  });
}

/**
 * Monthly: every focus nation scores its options and records why (for the debug overlay). It acts in some
 * months only. A rival’s war needs its own roll, the Phase 4 declaration chance, on top of preferring war.
 * Always draws the same number of random values per nation, so one nation’s choice never shifts another’s.
 */
export function runFocusAi(state: GameState, rng: Rng): GameState {
  let next = state;
  const ai: Record<CountryId, AiDecision> = { ...state.diplomacy.ai };
  for (const id of FOCUS_IDS) {
    const noise = rng.range(-AI.noise, AI.noise);
    const acts = rng.chance(AI.actionRate);
    const warRoll = rng.chance(declarationChance(next, id));
    const { utilities, inputs } = scoreActions(next, id, noise);
    let action = bestAction({ ...utilities, declareWar: UNAVAILABLE });
    const wantsWar = warRoll && utilities.declareWar > UNAVAILABLE && utilities.declareWar >= utilities.idle;
    if (wantsWar) action = 'declareWar';
    const acted = action !== 'idle' && (wantsWar || acts);
    ai[id] = { tick: next.clock.tick, action, acted, utilities, inputs };
    if (acted) next = performAction(next, id, action, rng);
  }
  return { ...next, diplomacy: { ...next.diplomacy, ai } };
}

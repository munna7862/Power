import { COUNTRY_CONTENT, COUNTRY_LIST } from '../content/world';
import type { Rng } from '../engine/rng';
import { clamp } from '../security/unrest';
import { appendLog } from '../state/log';
import type { CountryState, GameState } from '../state/types';
import { runFocusAi } from './ai';
import {
  EMBASSY,
  INCIDENT_DECAY,
  NEUTRAL_REPUTATION,
  RELATION_DRIFT,
  REPUTATION_CEILING,
  REPUTATION_DRIFT,
  WORLD,
} from './constants';
import { relationTarget } from './relations';
import { endTreaty, partnerOf } from './treaties';
import { logIncident } from './world';

/** Where India’s reputation is heading: a base level, built up by honoured pacts, trade and embassies. */
export function reputationTarget(state: Pick<GameState, 'diplomacy'>): number {
  const t = state.diplomacy.treaties;
  const pacts = t.filter((x) => x.type === 'nonAggression').length;
  const trade = t.filter((x) => x.type === 'trade').length;
  const embassies = t.filter((x) => x.type === 'embassy').length;
  return clamp(NEUTRAL_REPUTATION + 2 * pacts + trade + 0.5 * embassies, 40, REPUTATION_CEILING);
}

/** Where world tension is heading: a calm baseline plus a push for each crisis between other countries. */
export const tensionTarget = (state: Pick<GameState, 'diplomacy'>): number =>
  clamp(20 + WORLD.conflictTension * state.diplomacy.conflicts.length, 0, 100);

/**
 * Monthly diplomacy: embassy bills, expiring deals and offers, ending crises, reputation and tension, every
 * relation’s drift toward its target, the focus nations’ decisions and incidents among the rest.
 */
export function settleDiplomacy(state: GameState, rng: Rng): GameState {
  let next = state;
  const tick = next.clock.tick;

  // Embassy upkeep comes straight from the treasury.
  const embassies = next.diplomacy.treaties.filter((t) => t.type === 'embassy').length;
  if (embassies > 0) {
    next = { ...next, nation: { ...next.nation, treasury: next.nation.treasury - embassies * EMBASSY.monthly } };
  }

  // Treaties and measures that have run their course.
  for (const t of next.diplomacy.treaties.filter((x) => x.endTick !== null && x.endTick <= tick)) {
    const partner = COUNTRY_CONTENT[partnerOf(t)]?.name ?? partnerOf(t);
    next = endTreaty(next, t.id);
    next = appendLog(next, {
      severity: 'info',
      category: 'diplomacy',
      title:
        t.type === 'sanctions'
          ? `Sanctions by ${partner} have lapsed`
          : t.type === 'trade'
            ? `Trade contract with ${partner} has ended`
            : `Pact with ${partner} has expired`,
      body:
        t.type === 'sanctions'
          ? `The measures against India ended on schedule.`
          : `The term of the agreement is over. Propose a new one on the Diplomacy screen if you want to continue.`,
    });
  }

  // Offers nobody answered lapse quietly.
  const live = next.diplomacy.offers.filter((o) => o.expiresTick > tick);
  const conflicts = next.diplomacy.conflicts.filter((c) => c.endTick > tick);
  if (live.length !== next.diplomacy.offers.length || conflicts.length !== next.diplomacy.conflicts.length) {
    next = { ...next, diplomacy: { ...next.diplomacy, offers: live, conflicts } };
  }

  // Reputation and world tension settle toward their targets.
  const d = next.diplomacy;
  next = {
    ...next,
    diplomacy: {
      ...d,
      reputation: clamp(d.reputation + (reputationTarget(next) - d.reputation) * REPUTATION_DRIFT, 0, 100),
      worldTension: clamp(d.worldTension + (tensionTarget(next) - d.worldTension) * WORLD.tensionDecay, 0, 100),
    },
  };

  // Every relation drifts toward its target; incidents fade.
  const countries: Record<string, CountryState> = {};
  for (const c of COUNTRY_LIST) {
    const current = next.diplomacy.countries[c.id] as CountryState;
    const target = relationTarget(next, c.id);
    const incidents = current.incidents * INCIDENT_DECAY;
    countries[c.id] = {
      ...current,
      relation: clamp(current.relation + (target - current.relation) * RELATION_DRIFT, -100, 100),
      incidents: incidents < 0.5 ? 0 : incidents,
    };
  }
  next = { ...next, diplomacy: { ...next.diplomacy, countries } };

  // The focus nations decide what to do about India.
  next = runFocusAi(next, rng);

  // The others only drift and have the odd incident.
  const notable: { id: string; worse: boolean }[] = [];
  const moved: Record<string, CountryState> = { ...next.diplomacy.countries };
  for (const c of COUNTRY_LIST) {
    if (c.focus || !rng.chance(WORLD.incidentChance)) continue;
    const delta = rng.range(-6, 4);
    const current = moved[c.id] as CountryState;
    moved[c.id] = {
      ...current,
      relation: clamp(current.relation + delta, -100, 100),
      incidents: delta < 0 ? clamp(current.incidents - delta, 0, 100) : current.incidents,
    };
    if ((c.power >= 30 || c.neighbour) && Math.abs(delta) >= 3) notable.push({ id: c.id, worse: delta < 0 });
  }
  next = { ...next, diplomacy: { ...next.diplomacy, countries: moved } };
  for (const n of notable.slice(0, WORLD.maxIncidentLogs)) next = logIncident(next, n.id, n.worse);
  return next;
}

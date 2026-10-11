import type { CountryId, CountryPick } from '../content/ids';
import { COUNTRY_CONTENT, COUNTRY_LIST, type CountryContent } from '../content/world';
import type { Rng } from '../engine/rng';
import { clamp } from '../security/unrest';
import { appendLog } from '../state/log';
import type { Conflict, GameState } from '../state/types';
import { WORLD } from './constants';
import { atWarWithCountry, hasTreaty, relationOf } from './relations';

function eligible(state: GameState, c: CountryContent, kind: CountryPick): boolean {
  switch (kind) {
    case 'any':
      return c.power >= 15;
    case 'neighbour':
      return c.neighbour;
    case 'focus':
      return c.focus;
    case 'rival':
      return c.focus && c.neighbour && c.power >= 25;
    case 'friend':
      return c.focus && relationOf(state, c.id) > 15;
    case 'hostile':
      return c.power >= 30 && relationOf(state, c.id) < 0 && !atWarWithCountry(state, c.id);
    case 'poor':
      return c.gdp < 150 && c.population > 1 && relationOf(state, c.id) > -20;
  }
}

/** Picks a country for a diplomatic event, weighted toward the more important ones. Always draws once. */
export function pickCountry(state: GameState, kind: CountryPick, rng: Rng): CountryId | null {
  const pool = COUNTRY_LIST.filter((c) => eligible(state, c, kind));
  const roll = rng.next();
  if (pool.length === 0) return null;
  const weights = pool.map((c) => 5 + c.power);
  let pick = roll * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i] as number;
    if (pick < 0) return (pool[i] as CountryContent).id;
  }
  return (pool[pool.length - 1] as CountryContent).id;
}

/**
 * A crisis breaks out between countries in a region: the country the event is about and up to two of its
 * neighbours on the map. It shows on the map, raises world tension and lasts for `days`.
 */
export function startConflict(state: GameState, ref: CountryId | null, days: number, rng: Rng): GameState {
  const first = (ref && COUNTRY_CONTENT[ref]) || COUNTRY_LIST[Math.floor(rng.next() * COUNTRY_LIST.length)];
  if (!first) return state;
  const sameRegion = COUNTRY_LIST.filter((c) => c.subregion === first.subregion && c.id !== first.id);
  const others: CountryId[] = [];
  const pool = [...sameRegion];
  while (others.length < 2 && pool.length > 0) {
    const i = Math.floor(rng.next() * pool.length);
    others.push((pool.splice(i, 1)[0] as CountryContent).id);
  }
  const conflict: Conflict = {
    id: `cfl-${state.nextId}`,
    countries: [first.id, ...others],
    startTick: state.clock.tick,
    endTick: state.clock.tick + days,
  };
  const next: GameState = {
    ...state,
    diplomacy: {
      ...state.diplomacy,
      conflicts: [...state.diplomacy.conflicts, conflict],
      worldTension: clamp(state.diplomacy.worldTension + WORLD.conflictTension, 0, 100),
    },
    nextId: state.nextId + 1,
  };
  return next;
}

/** Countries currently in conflict, for the map’s war overlay. */
export function countriesInConflict(state: {
  diplomacy: Pick<GameState['diplomacy'], 'conflicts'>;
  military: { wars: readonly { rival: CountryId }[] };
}): Set<CountryId> {
  const ids = new Set<CountryId>();
  for (const c of state.diplomacy.conflicts) for (const id of c.countries) ids.add(id);
  for (const w of state.military.wars) ids.add(w.rival);
  return ids;
}

/** Whether the country is bound to India by a pact right now. */
export const hasPact = (state: Pick<GameState, 'diplomacy'>, id: CountryId): boolean =>
  hasTreaty(state, id, 'nonAggression');

/** Informs the inbox of a notable incident involving a non-focus country. */
export function logIncident(state: GameState, id: CountryId, worse: boolean): GameState {
  const name = COUNTRY_CONTENT[id]?.name ?? id;
  return appendLog(state, {
    severity: worse ? 'warning' : 'info',
    category: 'diplomacy',
    title: worse ? `Friction with ${name}` : `Goodwill from ${name}`,
    body: worse
      ? `A dispute over trade and visas has soured the mood in ${name}. Relations cool a little.`
      : `${name} praised India’s role in a regional forum. Relations warm a little.`,
  });
}

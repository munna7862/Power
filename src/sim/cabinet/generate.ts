import { NAME_CONTENT } from '../content';
import { IDEOLOGIES, MINISTRIES, REGIONS, type MinistryId, type RegionId } from '../content/ids';
import type { Rng } from '../engine/rng';
import type { CabinetState, GameState, Minister } from '../state/types';

export const CANDIDATES_PER_MINISTRY = 3;
/** Opening cabinet ministers are deliberately mediocre so there is room to improve. */
const OPENING_COMPETENCE: [number, number] = [35, 60];

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(0, items.length - 1)] as T;
const clampInt = (v: number) => Math.round(Math.max(0, Math.min(100, v)));

/** Rolls a fictional politician. Names are random first-name/surname pairs from content/names.json. */
function rollMinister(rng: Rng, id: string, taken: Set<string>, competenceRange?: [number, number]): Minister {
  let name = '';
  let region: RegionId = REGIONS[0];
  let gender: Minister['gender'] = 'female';
  for (let attempt = 0; attempt < 8 && (name === '' || taken.has(name)); attempt++) {
    region = pick(rng, REGIONS);
    gender = rng.chance(0.5) ? 'female' : 'male';
    const names = NAME_CONTENT[region];
    name = `${pick(rng, gender === 'female' ? names.female : names.male)} ${pick(rng, names.surnames)}`;
  }
  taken.add(name);

  const competence = competenceRange
    ? rng.int(competenceRange[0], competenceRange[1])
    : clampInt(20 + 75 * ((rng.next() + rng.next() + rng.next()) / 3));
  return {
    id,
    name,
    gender,
    region,
    competence,
    corruption: clampInt(rng.int(5, 75) - (competence - 50) * 0.2),
    loyalty: rng.int(35, 90),
    ideology: pick(rng, IDEOLOGIES),
    avatarSeed: rng.int(0, 0x7fffffff),
    appointedTick: null,
  };
}

function takenNames(cabinet: Pick<CabinetState, 'ministers'>): Set<string> {
  return new Set(MINISTRIES.flatMap((m) => cabinet.ministers[m]?.name ?? []));
}

/** Replaces every ministry's candidate pool. Runs at game start and every 1 January. */
export function refreshCandidates(state: GameState, rng: Rng): GameState {
  let nextId = state.nextId;
  const taken = takenNames(state.cabinet);
  const candidates = {} as Record<MinistryId, Minister[]>;
  for (const m of MINISTRIES) {
    candidates[m] = Array.from({ length: CANDIDATES_PER_MINISTRY }, () => rollMinister(rng, `min-${nextId++}`, taken));
  }
  return { ...state, cabinet: { ...state.cabinet, candidates }, nextId };
}

/** Appoints a mediocre opening cabinet and generates the first candidate pools. */
export function createOpeningCabinet(state: GameState, rng: Rng): GameState {
  let nextId = state.nextId;
  const taken = new Set<string>();
  const ministers = {} as Record<MinistryId, Minister | null>;
  for (const m of MINISTRIES) {
    ministers[m] = { ...rollMinister(rng, `min-${nextId++}`, taken, OPENING_COMPETENCE), appointedTick: 0 };
  }
  return refreshCandidates({ ...state, cabinet: { ministers, candidates: state.cabinet.candidates }, nextId }, rng);
}

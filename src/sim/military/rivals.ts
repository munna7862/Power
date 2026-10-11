import { RIVAL_CONTENT } from '../content/military';
import { RIVALS, type CountryId, type RivalId } from '../content/ids';
import { COUNTRY_CONTENT } from '../content/world';
import { adjustRelation, hasTreaty, relationOf } from '../diplomacy/relations';
import type { Rng } from '../engine/rng';
import { rulesFor } from '../state/difficulty';
import { appendLog } from '../state/log';
import type { GameState, RivalState } from '../state/types';
import { WAR } from './constants';
import { patchMilitary } from './forces';
import { militaryStrength, rivalEffective } from './strength';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export { adjustRelation };

export function patchRival(state: GameState, id: RivalId, patch: Partial<RivalState>): GameState {
  return patchMilitary(state, {
    rivals: { ...state.military.rivals, [id]: { ...state.military.rivals[id], ...patch } },
  });
}

export const atWarWith = (state: Pick<GameState, 'military'>, id: RivalId): boolean =>
  state.military.wars.some((w) => w.rival === id);

/** How hostile a rival is toward India, 0–100: bad relations, an aggressive temperament, little deterrence. */
export function hostility(state: Pick<GameState, 'military' | 'diplomacy'>, id: RivalId): number {
  const rival = state.military.rivals[id];
  if (rival.annexed) return 0;
  return clamp(
    35 -
      0.5 * relationOf(state, id) +
      0.25 * (COUNTRY_CONTENT[id]?.aggression ?? 40) -
      10 -
      0.15 * (state.military.deterrence - 40),
    0,
    100,
  );
}

/** The border tension the rivals add up to: the most hostile neighbour sets it. */
export function tensionTarget(state: Pick<GameState, 'military' | 'diplomacy'>): number {
  if (state.military.wars.length > 0) return 85;
  return clamp(0.6 * Math.max(...RIVALS.map((r) => hostility(state, r))), 0, 100);
}

/**
 * Monthly chance a rival declares war on India. Zero before the grace period, while at war with it already
 * or for peaceful or tiny states; otherwise driven by temperament, bad relations, India’s deterrence and
 * how the two armies compare, then scaled by the difficulty. Always zero with the "no wars" option.
 */
export function declarationChance(state: GameState, id: CountryId): number {
  const rival = (state.military.rivals as Record<string, RivalState | undefined>)[id];
  if (state.meta.options.noWars) return 0;
  if (!rival || rival.annexed || state.clock.tick < WAR.grace || atWarWith(state, id as RivalId)) return 0;
  if (hasTreaty(state, id, 'nonAggression')) return 0;
  const aggression = COUNTRY_CONTENT[id]?.aggression ?? 0;
  const relationFactor = clamp((20 - relationOf(state, id)) / 60, 0, 2);
  const deterrenceFactor = clamp(1 - (state.military.deterrence - 30) / 80, 0.1, 1.2);
  const mine = Math.max(militaryStrength(state.military), 1);
  const powerFactor = clamp(rivalEffective(rival) / mine, 0.12, 1.5);
  const recovering = rival.recoverUntilTick !== null && rival.recoverUntilTick > state.clock.tick ? 0 : 1;
  return (
    0.006 *
    (aggression / 50) ** 2 *
    relationFactor *
    deterrenceFactor *
    powerFactor *
    recovering *
    rulesFor(state).warChance
  );
}

/** Monthly: rivals grow, recover and drift in their attitude; spies probe India’s defences. */
export function updateRivals(state: GameState, rng: Rng): GameState {
  let next = state;
  for (const id of RIVALS) {
    const rival = next.military.rivals[id];
    if (rival.annexed) continue;
    const content = RIVAL_CONTENT[id];
    const recovering = rival.recoverUntilTick !== null && rival.recoverUntilTick > next.clock.tick;
    const atWar = atWarWith(next, id);
    const growth = atWar ? 0 : (content.growth / 12) * (recovering ? 0.5 : 1);
    next = patchRival(next, id, {
      strength: rival.strength * (1 + growth + rng.range(-0.002, 0.002)),
      readiness: clamp(rival.readiness + (atWar ? 0 : (70 - rival.readiness) * 0.15), 5, 100),
      recoverUntilTick: recovering ? rival.recoverUntilTick : null,
    });

    // Hostile services probe India’s defences now and then.
    if (rng.chance(0.03 * ((COUNTRY_CONTENT[id]?.aggression ?? 0) / 50))) {
      const m = next.military;
      const cover = m.counterIntel / 100 + (m.intelOps.some((o) => o.kind === 'counterIntel') ? 0.35 : 0);
      if (rng.chance(clamp(0.7 * cover, 0, 0.9))) {
        next = appendLog(next, {
          severity: 'good',
          category: 'military',
          title: `${content.name} spy ring uncovered`,
          body: `Counter-intelligence caught agents of ${content.name} probing military sites. No damage was done.`,
        });
        next = adjustRelation(next, id, -3);
      } else {
        next = patchMilitary(next, { readiness: clamp(next.military.readiness - 4, 0, 100) });
        next = appendLog(next, {
          severity: 'warning',
          category: 'military',
          title: `${content.name} agents probe your defences`,
          body: 'Foreign agents mapped sensitive sites before they were noticed. Readiness suffers while the leaks are plugged. Counter-intelligence reduces the risk.',
        });
      }
    }
  }
  return next;
}

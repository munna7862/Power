import { RIVALS } from '../content/ids';
import { clamp } from '../security/unrest';
import type { GameState } from '../state/types';
import { nuclearDeterrence } from './nuclear';
import { militaryStrength, rivalEffective } from './strength';

/** Where deterrence is heading: how India’s army compares with the strongest rival, plus any declared arsenal. */
export function deterrenceTarget(state: Pick<GameState, 'military'>): number {
  const mine = militaryStrength(state.military);
  const strongest = Math.max(1, ...RIVALS.map((r) => rivalEffective(state.military.rivals[r])));
  return clamp(40 * (mine / strongest) + nuclearDeterrence(state.military.nuclear), 0, 100);
}

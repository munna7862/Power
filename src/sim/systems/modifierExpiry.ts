import { removeExpired } from '../engine/modifiers';
import type { System } from '../engine/system';

export const modifierExpirySystem: System = {
  id: 'modifier-expiry',
  cadence: 'daily',
  run(state) {
    const modifiers = removeExpired(state.modifiers, state.clock.tick);
    return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
  },
};

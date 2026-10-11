import type { System } from '../engine/system';
import { resolveInvestigation } from '../security/investigations';

/** Settles anti-corruption inquiries when they are due. */
export const investigationSystem: System = {
  id: 'investigations',
  cadence: 'daily',
  run(state, { rng }) {
    const due = state.security.investigations.filter((i) => i.resolvesTick <= state.clock.tick);
    return due.reduce((s, inv) => resolveInvestigation(s, inv, rng), state);
  },
};

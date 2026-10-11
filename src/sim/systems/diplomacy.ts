import type { System } from '../engine/system';
import { settleDiplomacy } from '../diplomacy/monthly';

/**
 * Monthly diplomacy: treaties and offers, reputation and world tension, relation drift, the focus nations’
 * decisions (including a rival’s declaration of war) and incidents among the other countries.
 */
export const diplomacyMonthlySystem: System = {
  id: 'diplomacy-monthly',
  cadence: 'monthly',
  run(state, { rng }) {
    if (state.status.kind === 'over') return state;
    return settleDiplomacy(state, rng);
  },
};

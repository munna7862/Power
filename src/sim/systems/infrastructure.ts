import type { System } from '../engine/system';
import { completeBuilds } from '../infrastructure/build';

/** Daily: construction projects that have run their course open. */
export const infrastructureDailySystem: System = {
  id: 'infrastructure-daily',
  cadence: 'daily',
  run: (state) => (state.status.kind === 'over' ? state : completeBuilds(state)),
};

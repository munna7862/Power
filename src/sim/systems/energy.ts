import { completePlants } from '../energy/build';
import type { System } from '../engine/system';

/** Daily: power projects that have run their course connect to the grid. */
export const energyDailySystem: System = {
  id: 'energy-daily',
  cadence: 'daily',
  run: (state) => (state.status.kind === 'over' ? state : completePlants(state)),
};

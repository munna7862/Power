import { completeUpgrades, settleDepartmentFunding } from '../departments/services';
import type { System } from '../engine/system';

/** Monthly: underfunded departments run down and can lose a star. */
export const departmentsMonthlySystem: System = {
  id: 'departments-monthly',
  cadence: 'monthly',
  run: (state) => (state.status.kind === 'over' ? state : settleDepartmentFunding(state)),
};

/** Daily: service upgrades complete. */
export const departmentsDailySystem: System = {
  id: 'departments-daily',
  cadence: 'daily',
  run: (state) => (state.status.kind === 'over' ? state : completeUpgrades(state)),
};

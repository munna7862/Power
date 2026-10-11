import type { System } from '../engine/system';
import { annualReportSystem } from './annualReport';
import { approvalSystem } from './approval';
import { fiscalSystem } from './fiscal';
import { historySystem } from './history';
import { modifierExpirySystem } from './modifierExpiry';

/**
 * Fixed execution order. Changing it changes outcomes for a given seed,
 * so the determinism snapshot must be reviewed whenever this list changes.
 * Master plan order: economy → society → security → military → diplomacy → events → approval.
 */
export const SYSTEMS: readonly System[] = [
  modifierExpirySystem,
  fiscalSystem,
  approvalSystem,
  historySystem,
  annualReportSystem,
];

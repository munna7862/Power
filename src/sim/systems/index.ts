import type { System } from '../engine/system';
import { annualReportSystem } from './annualReport';
import { approvalSystem } from './approval';
import { cabinetSystem, candidateRefreshSystem } from './cabinet';
import { economySystem } from './economy';
import { fiscalSystem } from './fiscal';
import { historySystem } from './history';
import { modifierExpirySystem } from './modifierExpiry';
import { societySystem } from './society';

/**
 * Fixed execution order. Changing it changes outcomes for a given seed,
 * so the determinism snapshot must be reviewed whenever this list changes.
 * Master plan order: economy → society → security → military → diplomacy → events → approval.
 */
export const SYSTEMS: readonly System[] = [
  modifierExpirySystem,
  economySystem,
  fiscalSystem,
  societySystem,
  cabinetSystem,
  approvalSystem,
  historySystem,
  annualReportSystem,
  candidateRefreshSystem,
];

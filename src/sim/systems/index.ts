import type { System } from '../engine/system';
import { annualReportSystem } from './annualReport';
import { approvalSystem } from './approval';
import { cabinetSystem, candidateRefreshSystem } from './cabinet';
import { diplomacyMonthlySystem } from './diplomacy';
import { economySystem } from './economy';
import { eventsSystem } from './events';
import { fiscalSystem } from './fiscal';
import { historySystem } from './history';
import { investigationSystem } from './investigations';
import { leadershipSystem } from './leadership';
import { militaryDailySystem, militaryMonthlySystem } from './military';
import { modifierExpirySystem } from './modifierExpiry';
import { societySystem } from './society';
import { plotSystem, terrorSystem } from './terror';
import { termSystem } from './term';
import { riotCapSystem, unrestSystem } from './unrest';

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
  unrestSystem,
  terrorSystem,
  plotSystem,
  leadershipSystem,
  investigationSystem,
  cabinetSystem,
  militaryMonthlySystem,
  militaryDailySystem,
  diplomacyMonthlySystem,
  riotCapSystem,
  eventsSystem,
  approvalSystem,
  historySystem,
  annualReportSystem,
  termSystem,
  candidateRefreshSystem,
];

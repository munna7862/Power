import type { MinistryId } from '../content/ids';
import type { GameState } from '../state/types';
import { commandConfidence, protectionScore } from '../departments/quality';
import { COUP_RISK_THRESHOLD } from './constants';
import { clamp } from './unrest';

/** How safe the President is, 0–100: security funding, the close-protection service and the terror threat. */
export function presidentialSafety(
  state: Pick<GameState, 'departments' | 'security'>,
  efficiency: Record<MinistryId, number>,
): number {
  const guard = protectionScore(state);
  return clamp(
    55 +
      22 * (Math.min(efficiency.home, 1.8) - 1) +
      12 * (Math.min(efficiency.intelligence, 1.8) - 1) +
      0.15 * (guard - 60) -
      0.25 * (state.security.terrorThreat - 30),
    0,
    100,
  );
}

/** Monthly chance of an assassination attempt. */
export const assassinationAttemptChance = (terrorThreat: number): number => 0.0025 + 0.008 * (terrorThreat / 100);

/** Chance an attempt succeeds, given presidential safety. */
export const assassinationSuccessChance = (safety: number): number => clamp((70 - safety) / 100, 0.02, 0.6);

/** The level of military loyalty the armed forces are drifting toward. */
export function militaryLoyaltyTarget(
  state: Pick<GameState, 'departments' | 'nation' | 'military'>,
  efficiency: Record<MinistryId, number>,
): number {
  return clamp(
    35 +
      0.35 * commandConfidence(state) +
      0.2 * state.nation.approval +
      12 * (Math.min(efficiency.defence, 1.8) - 1) +
      0.12 * (state.military.morale - 65) -
      12 * Math.max(0, 1 - state.military.fundingRatio),
    0,
    100,
  );
}

/** Coup risk, 0–100, from military loyalty, the army command's confidence and approval. */
export function coupRisk(state: Pick<GameState, 'departments' | 'nation' | 'security'>): number {
  const trust = 0.45 * state.security.militaryLoyalty + 0.3 * commandConfidence(state) + 0.25 * state.nation.approval;
  return clamp(100 - trust, 0, 100);
}

/** Monthly chance of a coup: zero until the risk passes the threshold, then rising steeply. */
export function coupChance(risk: number): number {
  return risk <= COUP_RISK_THRESHOLD ? 0 : ((risk - COUP_RISK_THRESHOLD) / (100 - COUP_RISK_THRESHOLD)) * 0.12;
}

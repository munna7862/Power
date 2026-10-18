import { MINISTRY_CONTENT } from '../content';
import { DEPARTMENT_SERVICES, type MinistryId, type ServiceId } from '../content/ids';
import { multiplierFor } from '../engine/modifiers';
import type { GameState } from '../state/types';
import { MAX_STARS, OPENING_STARS, QUALITY_BASE, QUALITY_PER_STAR } from './constants';

type WithDepartments = Pick<GameState, 'departments'>;

/** A service's star rating (1–5). */
export const serviceStars = <M extends MinistryId>(
  state: WithDepartments,
  department: M,
  service: ServiceId<M>,
): number => state.departments.stars[department][service] ?? OPENING_STARS;

/** The average rating of a department's services. */
export function departmentStars(state: WithDepartments, department: MinistryId): number {
  const services: readonly ServiceId[] = DEPARTMENT_SERVICES[department];
  return (
    services.reduce((sum, s) => sum + (state.departments.stars[department][s] ?? OPENING_STARS), 0) / services.length
  );
}

/** How well a department is run, about 0.76 (one star everywhere) to 1.24 (five stars); 0.88 at the start. */
export const departmentQuality = (state: WithDepartments, department: MinistryId): number =>
  QUALITY_BASE + QUALITY_PER_STAR * departmentStars(state, department);

/**
 * A 0–100 score from one service's rating, on the scale the v1.0 formulas used for a minister's loyalty or
 * competence: two stars give 60 (the average opening minister), five stars 100, one star 40.
 */
export const serviceScore = (stars: number): number => Math.min(100, 20 + 20 * stars);

/** Confidence of the army command, 0–100: feeds coup risk, military loyalty and morale. */
export const commandConfidence = (state: WithDepartments): number =>
  serviceScore(serviceStars(state, 'defence', 'armyCommand'));

/** Strength of the President's close protection, 0–100. */
export const protectionScore = (state: WithDepartments): number =>
  serviceScore(serviceStars(state, 'home', 'presidentialProtection'));

/** Skill of the intelligence service, 0–100: feeds the success of intelligence operations. */
export const intelligenceSkill = (state: WithDepartments): number =>
  Math.min(100, 20 + 14 * departmentStars(state, 'intelligence'));

/** How much of each department's spending goes missing to petty corruption, 0–100 (41 at the start). */
export const leakagePressure = (state: WithDepartments): number => 55 - 7 * departmentStars(state, 'antiCorruption');

/** Funding of a department against its default allocation, after spending modifiers (1 = default). */
export const departmentFunding = (state: Pick<GameState, 'budget' | 'modifiers'>, department: MinistryId): number =>
  (state.budget.allocations[department] / MINISTRY_CONTENT[department].defaultAllocation) *
  multiplierFor(state.modifiers, 'economy.expenditure');

export const isMaxed = (stars: number): boolean => stars >= MAX_STARS;

import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, type MinistryId } from '../content/ids';
import { leakagePressure } from '../departments/quality';
import { allEfficiencies } from '../economy/model';
import type { Rng } from '../engine/rng';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState, Investigation } from '../state/types';
import { INVESTIGATION_COST, INVESTIGATION_DAYS, MAX_INVESTIGATIONS } from './constants';
import { clamp } from './unrest';

/** How long a finding keeps the audited department cleaner, and by how much (corruption target points). */
export const AUDIT_FINDING_DAYS = 365;
export const AUDIT_FINDING_CORRUPTION = -2;

/** Why an audit cannot be launched, or null. */
export function validateInvestigation(state: GameState, department: MinistryId): string | null {
  if (!MINISTRIES.includes(department)) return `Unknown department ${department}.`;
  if (state.security.investigations.some((i) => i.department === department)) {
    return `The ${MINISTRY_CONTENT[department].shortName} department is already being audited.`;
  }
  if (state.security.investigations.length >= MAX_INVESTIGATIONS) {
    return `The bureau can only run ${MAX_INVESTIGATIONS} audits at a time.`;
  }
  if (state.nation.treasury < INVESTIGATION_COST) return 'The treasury cannot cover the cost of an audit.';
  return null;
}

export function startInvestigation(state: GameState, department: MinistryId): GameState {
  const investigation: Investigation = {
    id: `inv-${state.nextId}`,
    department,
    startedTick: state.clock.tick,
    resolvesTick: state.clock.tick + INVESTIGATION_DAYS,
  };
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury - INVESTIGATION_COST },
      security: { ...state.security, investigations: [...state.security.investigations, investigation] },
      nextId: state.nextId + 1,
    },
    {
      severity: 'info',
      category: 'corruption',
      title: `Audit opened: ${MINISTRY_CONTENT[department].shortName}`,
      body: `The anti-corruption bureau begins going through the ${MINISTRY_CONTENT[department].shortName} department's accounts. Results are expected in about two months.`,
    },
  );
}

/**
 * Chance an audit finds misuse: likelier when petty corruption is widespread (national corruption and weak
 * anti-corruption services) and when the bureau is well funded.
 */
export function exposureChance(
  state: Pick<GameState, 'economy' | 'departments'>,
  antiCorruptionEfficiency: number,
): number {
  const pressure = (state.economy.corruption + leakagePressure(state)) / 2;
  return clamp((pressure / 100) * (0.5 + 0.5 * Math.min(antiCorruptionEfficiency, 1.6)) + 0.05, 0.05, 0.9);
}

/** Settles an audit whose time has come. A finding cleans up the department and earns some credit. */
export function resolveInvestigation(state: GameState, investigation: Investigation, rng: Rng): GameState {
  const remaining = state.security.investigations.filter((i) => i.id !== investigation.id);
  let next: GameState = { ...state, security: { ...state.security, investigations: remaining } };
  const name = MINISTRY_CONTENT[investigation.department].shortName;
  if (!rng.chance(exposureChance(next, allEfficiencies(next).antiCorruption))) {
    return appendLog(next, {
      severity: 'info',
      category: 'corruption',
      title: `Audit finds the books in order: ${name}`,
      body: `Auditors found nothing seriously wrong in the ${name} department.`,
    });
  }
  next = addTimedModifier(
    next,
    {
      source: 'audit',
      label: `Audit of ${name}`,
      target: 'politics.corruption',
      kind: 'add',
      value: AUDIT_FINDING_CORRUPTION,
    },
    AUDIT_FINDING_DAYS,
  );
  next = addTimedModifier(
    next,
    { source: 'audit', label: `Audit of ${name}`, target: 'politics.approvalTarget', kind: 'add', value: 1 },
    60,
  );
  return appendLog(
    { ...next, economy: { ...next.economy, corruption: clamp(next.economy.corruption - 3, 0, 100) } },
    {
      severity: 'good',
      category: 'corruption',
      title: `Audit exposes misuse: ${name}`,
      body: `Auditors traced diverted funds in the ${name} department. The officials responsible are suspended, and the department will be cleaner for a year.`,
    },
  );
}

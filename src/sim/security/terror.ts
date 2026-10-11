import type { MinistryId, OperationKind } from '../content/ids';
import type { GameState } from '../state/types';
import { clamp, type Driver, type Explained } from './unrest';

export const hasOperation = (state: Pick<GameState, 'security'>, kind: OperationKind) =>
  state.security.operations.some((o) => o.kind === kind);

export function averageUnrest(state: Pick<GameState, 'security'>): number {
  const values = Object.values(state.security.unrest);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** The terror threat level the country is heading toward. */
export function terrorTarget(state: Pick<GameState, 'security'>, efficiency: Record<MinistryId, number>): Explained {
  const drivers: Driver[] = [
    { label: 'Baseline', value: 15 },
    { label: 'Border tension', value: 0.35 * state.security.borderTension },
    { label: 'Domestic unrest', value: 0.15 * averageUnrest(state) },
    { label: 'Intelligence services', value: -18 * (Math.min(efficiency.intelligence, 1.8) - 1) },
    { label: 'Surveillance operation', value: hasOperation(state, 'surveillance') ? -8 : 0 },
    { label: 'Sealed border', value: hasOperation(state, 'borderSeal') ? -12 : 0 },
  ];
  return {
    total: clamp(
      drivers.reduce((s, d) => s + d.value, 0),
      0,
      100,
    ),
    drivers,
  };
}

/** Chance each month that a new plot forms. */
export const plotFormationChance = (threat: number): number => 0.05 + 0.25 * (threat / 100);

/** Chance intelligence uncovers a newly forming plot before it becomes a live threat. */
export function intelligenceFoilChance(
  state: Pick<GameState, 'security'>,
  efficiency: Record<MinistryId, number>,
): number {
  return clamp(0.15 + 0.35 * efficiency.intelligence + (hasOperation(state, 'surveillance') ? 0.15 : 0), 0.1, 0.9);
}

/** Chance a live plot succeeds when it strikes. */
export function plotSuccessChance(mitigation: number, efficiency: Record<MinistryId, number>): number {
  return clamp(0.85 - mitigation - 0.2 * (Math.min(efficiency.home, 1.6) - 1), 0.1, 0.95);
}

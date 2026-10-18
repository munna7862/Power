import { allEfficiencies } from '../economy/model';
import { REGION_LABELS, REGIONS, type OperationKind } from '../content/ids';
import type { Rng } from '../engine/rng';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';
import { BORDER_SEAL_GROWTH, OPERATIONS } from './constants';
import { clamp } from './unrest';

/** Why an operation cannot be launched right now, or null. */
export function operationBlocked(state: GameState, kind: OperationKind): string | null {
  if (state.security.operations.some((o) => o.kind === kind)) {
    return kind === 'raid' ? 'Forces are still recovering from the last raid.' : 'That operation is already running.';
  }
  if (state.nation.treasury < OPERATIONS[kind].cost) return 'The treasury cannot cover this operation.';
  return null;
}

const earliestPlot = (state: GameState) =>
  [...state.security.plots].sort((a, b) => a.strikeTick - b.strikeTick)[0] ?? null;

/**
 * Starts an operation. A raid acts at once; surveillance and border sealing run for their duration and
 * are counted when threats and plots are settled. Costs are charged by the caller (command or event choice).
 */
export function launchOperation(state: GameState, kind: OperationKind, rng: Rng, plotId: string | null): GameState {
  const spec = OPERATIONS[kind];
  let next = state;
  if (!state.security.operations.some((o) => o.kind === kind)) {
    next = {
      ...next,
      security: {
        ...next.security,
        operations: [
          ...next.security.operations,
          { id: `op-${next.nextId}`, kind, startedTick: next.clock.tick, endsTick: next.clock.tick + spec.days },
        ],
      },
      nextId: next.nextId + 1,
    };
    if (kind === 'borderSeal') {
      next = addTimedModifier(
        next,
        {
          source: 'operation',
          label: 'Border sealed',
          target: 'economy.growth',
          kind: 'add',
          value: BORDER_SEAL_GROWTH,
        },
        spec.days,
      );
    }
  }
  if (kind !== 'raid') {
    return appendLog(next, {
      severity: 'info',
      category: 'terror',
      title: spec.label,
      body:
        kind === 'surveillance'
          ? 'Surveillance is stepped up for four months.'
          : 'Border crossings are shut for two months.',
    });
  }

  const intel = Math.min(allEfficiencies(state).intelligence, 1.6);
  if (rng.chance(0.25)) {
    const region = REGIONS[rng.int(0, REGIONS.length - 1)] as (typeof REGIONS)[number];
    next = addTimedModifier(
      next,
      {
        source: 'operation',
        label: 'Botched raid',
        target: 'politics.approvalTarget',
        kind: 'add',
        value: -2,
      },
      45,
    );
    return appendLog(
      {
        ...next,
        security: {
          ...next.security,
          terrorThreat: clamp(next.security.terrorThreat + 2, 0, 100),
          unrest: { ...next.security.unrest, [region]: clamp(next.security.unrest[region] + 5, 0, 100) },
        },
      },
      {
        severity: 'warning',
        category: 'terror',
        title: 'Raid goes wrong',
        body: `A raid found the wrong house and the wrong people. Protests broke out in the ${REGION_LABELS[region]}, and the threat level has crept up.`,
      },
    );
  }

  const drop = (5 + 4 * rng.next()) * (0.7 + 0.3 * intel);
  next = {
    ...next,
    security: { ...next.security, terrorThreat: clamp(next.security.terrorThreat - drop, 0, 100) },
  };
  next = appendLog(next, {
    severity: 'good',
    category: 'terror',
    title: 'Raid disrupts a network',
    body: `Security forces dismantled a suspected cell. The national terror threat falls by ${drop.toFixed(1)} points.`,
  });

  const target = (plotId ? next.security.plots.find((p) => p.id === plotId) : null) ?? earliestPlot(next);
  if (target) {
    if (rng.chance(0.5)) {
      next = {
        ...next,
        security: {
          ...next.security,
          plots: next.security.plots.filter((p) => p.id !== target.id),
          plotsFoiled: next.security.plotsFoiled + 1,
        },
      };
      next = appendLog(next, {
        severity: 'good',
        category: 'terror',
        title: 'Plot stopped by the raid',
        body: `Documents seized in the raid exposed ${target.group}'s plan for the ${REGION_LABELS[target.region]}. The attack will not happen.`,
      });
    } else {
      next = {
        ...next,
        security: {
          ...next.security,
          plots: next.security.plots.map((p) =>
            p.id === target.id ? { ...p, mitigation: clamp(p.mitigation + 0.15, 0, 0.75) } : p,
          ),
        },
      };
    }
  }
  return next;
}

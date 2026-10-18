import { RIVAL_CONTENT } from '../content/military';
import { INTEL_KINDS, RIVALS, type IntelKind, type RivalId } from '../content/ids';
import { EVENT_CONTENT } from '../content/events';
import { intelligenceSkill } from '../departments/quality';
import { allEfficiencies } from '../economy/model';
import type { Rng } from '../engine/rng';
import { fireEvent } from '../events/engine';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState, IntelOp } from '../state/types';
import {
  EXPOSURE_ON_FAILURE,
  EXPOSURE_ON_SABOTAGE_SUCCESS,
  EXPOSURE_RELATION_HIT,
  INTEL_OPS,
  MAX_INTEL_OPS,
} from './constants';
import { patchMilitary } from './forces';
import { addIncident } from '../diplomacy/relations';
import { adjustRelation, patchRival } from './rivals';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** The intelligence service's skill, 0–100, from its services' star ratings (48 at the start). */
export const directorCompetence = (state: Pick<GameState, 'departments'>): number => intelligenceSkill(state);

/**
 * Chance an operation succeeds: intelligence funding and the service's skill help;
 * the target’s counter-intelligence and the operation’s own difficulty hurt.
 */
export function opSuccessChance(state: GameState, kind: IntelKind, target: RivalId): number {
  const funding = Math.min(allEfficiencies(state).intelligence, 1.6);
  const rival = RIVAL_CONTENT[target];
  return clamp(
    0.72 +
      0.3 * (funding - 1) +
      0.25 * ((directorCompetence(state) - 50) / 50) -
      0.35 * (rival.counterIntel / 100) -
      INTEL_OPS[kind].difficulty,
    0.08,
    0.92,
  );
}

/** Chance that a failed operation is blown rather than quietly abandoned. */
export const exposureOnFailure = (target: RivalId): number =>
  clamp(EXPOSURE_ON_FAILURE + RIVAL_CONTENT[target].counterIntel / 400, 0, 0.9);

export function validateIntelOp(state: GameState, kind: IntelKind, target: RivalId | null): string | null {
  if (!INTEL_KINDS.includes(kind)) return `Unknown operation ${kind}.`;
  const { intelOps, rivals } = state.military;
  if (intelOps.length >= MAX_INTEL_OPS) return `At most ${MAX_INTEL_OPS} intelligence operations can run at once.`;
  if (INTEL_OPS[kind].cost > state.nation.treasury) return 'The treasury cannot cover this operation.';
  if (kind === 'counterIntel') {
    return intelOps.some((o) => o.kind === 'counterIntel') ? 'A counter-intelligence sweep is already running.' : null;
  }
  if (!target || !RIVALS.includes(target)) return 'Choose a country to target.';
  if (rivals[target].annexed) return 'That country no longer exists as a separate state.';
  if (intelOps.some((o) => o.kind === kind && o.target === target)) return 'That operation is already running.';
  return null;
}

export function launchIntelOp(state: GameState, kind: IntelKind, target: RivalId | null): GameState {
  const spec = INTEL_OPS[kind];
  const op: IntelOp = {
    id: `intel-${state.nextId}`,
    kind,
    target: kind === 'counterIntel' ? null : target,
    startedTick: state.clock.tick,
    endsTick: state.clock.tick + spec.days,
  };
  const next = {
    ...patchMilitary(state, { intelOps: [...state.military.intelOps, op] }),
    nextId: state.nextId + 1,
    nation: { ...state.nation, treasury: state.nation.treasury - spec.cost },
  };
  return appendLog(next, {
    severity: 'info',
    category: 'military',
    title: `${spec.label} under way`,
    body:
      kind === 'counterIntel'
        ? 'Security services begin a four-month sweep for foreign spies.'
        : `An operation against ${RIVAL_CONTENT[op.target as RivalId].name} is under way. Results in ${spec.days} days; the services will report whether it was blown.`,
  });
}

/** An operation is exposed: relations sour, voters frown and a diplomatic incident lands on the President’s desk. */
function expose(state: GameState, kind: 'recon' | 'sabotage', target: RivalId, rng: Rng): GameState {
  let next = adjustRelation(state, target, -EXPOSURE_RELATION_HIT[kind]);
  next = addIncident(next, target, EXPOSURE_RELATION_HIT[kind] / 2);
  next = addTimedModifier(
    next,
    {
      source: 'intel-exposed',
      label: 'Spy scandal',
      target: 'politics.approvalTarget',
      kind: 'add',
      value: kind === 'sabotage' ? -3 : -1.5,
    },
    60,
  );
  const incident = EVENT_CONTENT['diplomatic-incident'];
  return incident ? fireEvent(next, incident, null, target, rng) : next;
}

/** Daily: resolves operations that have run their course. */
export function resolveIntelOps(state: GameState, rng: Rng): GameState {
  const now = state.clock.tick;
  const done = state.military.intelOps.filter((o) => o.endsTick <= now);
  if (done.length === 0) return state;
  let next = patchMilitary(state, { intelOps: state.military.intelOps.filter((o) => o.endsTick > now) });
  for (const op of done) {
    if (op.kind === 'counterIntel' || !op.target) {
      next = appendLog(next, {
        severity: 'good',
        category: 'military',
        title: 'Counter-intelligence sweep complete',
        body: 'The services report a tighter ring around sensitive sites. Cover will fade slowly now that the sweep has ended.',
      });
      continue;
    }
    const target = op.target;
    const name = RIVAL_CONTENT[target].name;
    const success = rng.chance(opSuccessChance(next, op.kind, target));
    if (success) {
      if (op.kind === 'recon') {
        const rival = next.military.rivals[target];
        next = patchRival(next, target, {
          sighting: { tick: now, strength: rival.strength, readiness: rival.readiness },
        });
        next = appendLog(next, {
          severity: 'good',
          category: 'military',
          title: `Recon of ${name} complete`,
          body: 'Agents and satellites have mapped the enemy order of battle. The estimate on the Military screen is now sharp, and will blur as it ages.',
        });
      } else {
        const rival = next.military.rivals[target];
        const cut = 18 + 10 * rng.next();
        next = patchRival(next, target, {
          readiness: clamp(rival.readiness - cut, 5, 100),
          strength: rival.strength * 0.97,
        });
        next = appendLog(next, {
          severity: 'good',
          category: 'military',
          title: `Sabotage in ${name} succeeds`,
          body: `Depots and logistics were disrupted. ${name}’s readiness falls by ${cut.toFixed(0)} points.`,
        });
        if (rng.chance(EXPOSURE_ON_SABOTAGE_SUCCESS)) next = expose(next, 'sabotage', target, rng);
      }
    } else if (rng.chance(exposureOnFailure(target))) {
      next = appendLog(next, {
        severity: 'warning',
        category: 'military',
        title: `Operation against ${name} blown`,
        body: 'Agents were caught. The foreign ministry expects a protest note.',
      });
      next = expose(next, op.kind, target, rng);
    } else {
      next = appendLog(next, {
        severity: 'info',
        category: 'military',
        title: `Operation against ${name} fails quietly`,
        body: 'The operation produced nothing, and nobody noticed. The money is spent.',
      });
    }
  }
  return next;
}

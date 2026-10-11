import { DRILL_KINDS, type DrillKind } from '../content/ids';
import type { Rng } from '../engine/rng';
import { appendLog } from '../state/log';
import type { DrillReport, GameState } from '../state/types';
import { DRILLS, MAX_DRILLS, MAX_REPORTS } from './constants';
import { patchMilitary } from './forces';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function validateDrill(state: GameState, kind: DrillKind): string | null {
  if (!DRILL_KINDS.includes(kind)) return `Unknown drill ${kind}.`;
  const { drills, procurementFund } = state.military;
  if (drills.some((d) => d.kind === kind)) return 'That exercise is already under way.';
  if (drills.length >= MAX_DRILLS) return `At most ${MAX_DRILLS} exercises can run at once.`;
  if (DRILLS[kind].cost > procurementFund) return 'The procurement fund cannot cover this exercise.';
  return null;
}

/** Starts a drill, paid for from the procurement fund. Results arrive when it ends. */
export function startDrill(state: GameState, kind: DrillKind): GameState {
  const spec = DRILLS[kind];
  const drill = {
    id: `drill-${state.nextId}`,
    kind,
    startedTick: state.clock.tick,
    endsTick: state.clock.tick + spec.days,
  };
  return {
    ...patchMilitary(state, {
      procurementFund: state.military.procurementFund - spec.cost,
      drills: [...state.military.drills, drill],
    }),
    nextId: state.nextId + 1,
  };
}

/**
 * Daily: finishes drills that have run their course. Readiness, morale and deterrence rise by the drill’s
 * gains; an accident costs the morale gain and a little readiness instead.
 */
export function completeDrills(state: GameState, rng: Rng): GameState {
  const now = state.clock.tick;
  const done = state.military.drills.filter((d) => d.endsTick <= now);
  if (done.length === 0) return state;
  let next = patchMilitary(state, { drills: state.military.drills.filter((d) => d.endsTick > now) });
  for (const drill of done) {
    const spec = DRILLS[drill.kind];
    const accident = rng.chance(spec.accident);
    const report: DrillReport = {
      kind: drill.kind,
      date: next.clock.date,
      readiness: accident ? spec.readiness * 0.4 : spec.readiness,
      morale: accident ? -spec.morale : spec.morale,
      deterrence: accident ? spec.deterrence * 0.3 : spec.deterrence,
      accident,
    };
    const m = next.military;
    next = patchMilitary(next, {
      readiness: clamp(m.readiness + report.readiness, 0, 100),
      morale: clamp(m.morale + report.morale, 0, 100),
      deterrence: clamp(m.deterrence + report.deterrence, 0, 100),
      drillReports: [report, ...m.drillReports].slice(0, MAX_REPORTS),
    });
    next = appendLog(next, {
      severity: accident ? 'warning' : 'good',
      category: 'military',
      title: `${spec.label} ${accident ? 'ends in an accident' : 'complete'}`,
      body: accident
        ? 'A training accident cost lives and shook confidence in the exercise. Readiness gains were limited and morale dipped.'
        : `Readiness +${report.readiness}, morale +${report.morale}, deterrence +${report.deterrence}. Rivals take note.`,
    });
  }
  return next;
}

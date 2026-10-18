import { EVENT_CONTENT, THREAT_GROUPS } from '../content/events';
import { REGION_LABELS, REGIONS } from '../content/ids';
import { allEfficiencies } from '../economy/model';
import type { System } from '../engine/system';
import { scaleFactor } from '../events/effects';
import { fireEvent } from '../events/engine';
import { addTimedModifier } from '../politics/policy';
import {
  hasOperation,
  intelligenceFoilChance,
  plotFormationChance,
  plotSuccessChance,
  terrorTarget,
} from '../security/terror';
import { clamp } from '../security/unrest';
import { appendLog } from '../state/log';
import type { GameState, Plot } from '../state/types';

/** Event raised when a plot slips past intelligence. It carries the plot's id as its reference. */
export const TERROR_WARNING_EVENT = 'terror-warning';
/** Event queued a few days after a successful attack. */
export const TERROR_AFTERMATH_EVENT = 'terror-aftermath';

const BORDER_TENSION_BASELINE = 30;

/**
 * Monthly terror picture: the threat level and border tension drift, and fictional groups may start
 * plotting. Intelligence gets the first chance to foil a plot; the rest become live threats with a deadline.
 */
export const terrorSystem: System = {
  id: 'terror',
  cadence: 'monthly',
  run(state, { rng }) {
    const eff = allEfficiencies(state);
    const target = terrorTarget(state, eff).total;
    const { security } = state;
    let next: GameState = {
      ...state,
      security: {
        ...security,
        terrorThreat: clamp(
          security.terrorThreat + (target - security.terrorThreat) * 0.08 + rng.range(-0.5, 0.5),
          0,
          100,
        ),
        borderTension: clamp(
          security.borderTension + (BORDER_TENSION_BASELINE - security.borderTension) * 0.03 + rng.range(-0.4, 0.4),
          0,
          100,
        ),
      },
    };

    if (!rng.chance(plotFormationChance(next.security.terrorThreat))) return next;
    const group = THREAT_GROUPS[rng.int(0, THREAT_GROUPS.length - 1)] as string;
    const region = REGIONS[rng.int(0, REGIONS.length - 1)] as (typeof REGIONS)[number];

    if (rng.chance(intelligenceFoilChance(next, eff))) {
      next = addTimedModifier(
        {
          ...next,
          security: {
            ...next.security,
            terrorThreat: clamp(next.security.terrorThreat - 3, 0, 100),
            plotsFoiled: next.security.plotsFoiled + 1,
          },
        },
        {
          source: 'security',
          label: 'Terror plot foiled',
          target: 'politics.approvalTarget',
          kind: 'add',
          value: 1.5,
        },
        45,
      );
      return appendLog(next, {
        severity: 'good',
        category: 'terror',
        title: `Intelligence foils a plot by ${group}`,
        body: `Agents uncovered ${group} preparing an attack in the ${REGION_LABELS[region]}. The cell was rolled up before it could act.`,
      });
    }

    const plot: Plot = {
      id: `plot-${next.nextId}`,
      group,
      region,
      strikeTick: next.clock.tick + rng.int(25, 60),
      mitigation: 0,
    };
    next = { ...next, security: { ...next.security, plots: [...next.security.plots, plot] }, nextId: next.nextId + 1 };
    const warning = EVENT_CONTENT[TERROR_WARNING_EVENT];
    return warning ? fireEvent(next, warning, region, plot.id, rng) : next;
  },
};

/** Daily: operations end, and plots whose day has come either strike or are stopped at the last moment. */
export const plotSystem: System = {
  id: 'plots',
  cadence: 'daily',
  run(state, { rng }) {
    const now = state.clock.tick;
    let next = state;
    if (next.security.operations.some((o) => o.endsTick <= now)) {
      next = {
        ...next,
        security: { ...next.security, operations: next.security.operations.filter((o) => o.endsTick > now) },
      };
    }

    const due = next.security.plots.filter((p) => p.strikeTick <= now);
    if (due.length === 0) return next;
    const eff = allEfficiencies(next);
    for (const plot of due) {
      const bonus = (hasOperation(next, 'surveillance') ? 0.2 : 0) + (hasOperation(next, 'borderSeal') ? 0.4 : 0);
      const success = rng.chance(plotSuccessChance(next, Math.min(plot.mitigation + bonus, 0.75), eff));
      next = {
        ...next,
        security: { ...next.security, plots: next.security.plots.filter((p) => p.id !== plot.id) },
        events: { ...next.events, pending: next.events.pending.filter((p) => p.ref !== plot.id) },
      };
      const place = REGION_LABELS[plot.region];

      if (!success) {
        next = appendLog(
          { ...next, security: { ...next.security, plotsFoiled: next.security.plotsFoiled + 1 } },
          {
            severity: 'good',
            category: 'terror',
            title: `Attack by ${plot.group} stopped`,
            body: `Security forces in the ${place} intercepted ${plot.group} at the last moment. No attack took place.`,
          },
        );
        continue;
      }

      const severity = rng.range(0.7, 1.3);
      const mitigation = scaleFactor(next, { ministry: 'home', mode: 'mitigate' });
      next = addTimedModifier(
        next,
        {
          source: 'terror',
          label: `Attack in the ${place}`,
          target: 'politics.approvalTarget',
          kind: 'add',
          value: -4 * severity * mitigation,
        },
        120,
      );
      next = addTimedModifier(
        next,
        {
          source: 'terror',
          label: `Disruption after attack in the ${place}`,
          target: 'economy.growth',
          kind: 'add',
          value: -0.002,
        },
        90,
      );
      next = {
        ...next,
        security: {
          ...next.security,
          terrorThreat: clamp(next.security.terrorThreat + 8, 0, 100),
          unrest: {
            ...next.security.unrest,
            [plot.region]: clamp(next.security.unrest[plot.region] + 10 * severity, 0, 100),
          },
          attacksSuffered: next.security.attacksSuffered + 1,
        },
        events: {
          ...next.events,
          scheduled: [
            ...next.events.scheduled,
            { eventId: TERROR_AFTERMATH_EVENT, dueTick: now + 3, region: plot.region },
          ],
        },
      };
      next = appendLog(next, {
        severity: 'critical',
        category: 'terror',
        title: `Attack in the ${place}`,
        body: `${plot.group} carried out an attack in the ${place}. Emergency services responded; the nation mourns and demands answers.`,
      });
    }
    return next;
  },
};

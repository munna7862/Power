import type { System } from '../engine/system';
import { deterrenceTarget } from '../military/deterrence';
import { completeDrills } from '../military/drills';
import { completeProduction, patchMilitary, settleForces } from '../military/forces';
import { resolveIntelOps } from '../military/intel';
import { advanceProgram } from '../military/nuclear';
import { tensionTarget, updateRivals } from '../military/rivals';
import { settleWars, stepWars } from '../military/war';
import { clamp } from '../security/unrest';

/**
 * Daily military business: equipment and research arrive, drills and intelligence operations finish, and
 * every war plays a round on each front.
 */
export const militaryDailySystem: System = {
  id: 'military-daily',
  cadence: 'daily',
  run(state, { rng }) {
    if (state.status.kind === 'over') return state;
    let next = completeProduction(state);
    next = completeDrills(next, rng);
    next = resolveIntelOps(next, rng);
    return stepWars(next, rng);
  },
};

/**
 * Monthly military business: upkeep and the procurement fund, readiness and morale, deterrence and border
 * tension, rivals’ growth and spying, the nuclear program and the cost of war. Rivals’ declarations of war
 * are made by the AI in the diplomacy system.
 */
export const militaryMonthlySystem: System = {
  id: 'military-monthly',
  cadence: 'monthly',
  run(state, { rng }) {
    if (state.status.kind === 'over') return state;
    let next = settleForces(state);
    next = updateRivals(next, rng);
    next = advanceProgram(next);
    next = settleWars(next, rng);

    // Deterrence: the drills’ boost fades back toward what the army and arsenal support.
    const m = next.military;
    const counterIntelTarget = 35 + (m.intelOps.some((o) => o.kind === 'counterIntel') ? 40 : 0);
    next = patchMilitary(next, {
      deterrence: clamp(m.deterrence + (deterrenceTarget(next) - m.deterrence) * 0.2, 0, 100),
      counterIntel: clamp(m.counterIntel + (counterIntelTarget - m.counterIntel) * 0.25, 0, 100),
    });
    next = {
      ...next,
      security: {
        ...next.security,
        borderTension: clamp(
          next.security.borderTension + (tensionTarget(next) - next.security.borderTension) * 0.2,
          0,
          100,
        ),
      },
    };

    return next;
  },
};

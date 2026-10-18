import { DEPARTMENT_CONTENT, MINISTRY_CONTENT } from '../content';
import { DEPARTMENT_SERVICES, MINISTRIES, type MinistryId, type ServiceId } from '../content/ids';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { DepartmentsState, GameState } from '../state/types';
import {
  MAX_STARS,
  MAX_UPGRADES,
  MIN_STARS,
  OPENING_STARS,
  UNDERFUNDED_BELOW,
  UNDERFUNDED_MONTHS,
  UPGRADE_COST_PER_STAR,
  UPGRADE_DAYS,
} from './constants';
import { departmentFunding } from './quality';

/** Every service at the opening rating, no upgrades running. */
export function openingDepartments(): DepartmentsState {
  return {
    stars: Object.fromEntries(
      MINISTRIES.map((m) => [m, Object.fromEntries(DEPARTMENT_SERVICES[m].map((s) => [s, OPENING_STARS]))]),
    ) as DepartmentsState['stars'],
    underfundedMonths: Object.fromEntries(MINISTRIES.map((m) => [m, 0])) as Record<MinistryId, number>,
    upgrades: [],
  };
}

const serviceName = (department: MinistryId, service: ServiceId): string =>
  DEPARTMENT_CONTENT[department].services.find((s) => s.id === service)?.name ?? service;

const starsOf = (state: Pick<GameState, 'departments'>, department: MinistryId, service: ServiceId): number =>
  state.departments.stars[department][service] ?? OPENING_STARS;

/** ₹ crore to raise a service by one star from its current rating. */
export const upgradeCost = (
  state: Pick<GameState, 'departments'>,
  department: MinistryId,
  service: ServiceId,
): number => UPGRADE_COST_PER_STAR * (starsOf(state, department, service) + 1);

const isService = (department: MinistryId, service: string): service is ServiceId =>
  (DEPARTMENT_SERVICES[department] as readonly string[]).includes(service);

/** Why a service cannot be upgraded now, or null. */
export function validateUpgrade(state: GameState, department: MinistryId, service: string): string | null {
  if (!MINISTRIES.includes(department)) return `Unknown department ${department}.`;
  if (!isService(department, service)) return `Unknown service ${service}.`;
  if (starsOf(state, department, service) >= MAX_STARS) return 'That service is already rated five stars.';
  if (state.departments.upgrades.some((u) => u.department === department && u.service === service)) {
    return 'That service is already being upgraded.';
  }
  if (state.departments.upgrades.length >= MAX_UPGRADES) {
    return `At most ${MAX_UPGRADES} upgrades can run at once.`;
  }
  if (state.nation.treasury < upgradeCost(state, department, service)) {
    return 'The treasury cannot cover this upgrade.';
  }
  return null;
}

/** Pays for an upgrade; the service gains its star when it completes. */
export function startUpgrade(state: GameState, department: MinistryId, service: ServiceId): GameState {
  const cost = upgradeCost(state, department, service);
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury - cost },
      departments: {
        ...state.departments,
        upgrades: [
          ...state.departments.upgrades,
          { id: `upg-${state.nextId}`, department, service, endsTick: state.clock.tick + UPGRADE_DAYS },
        ],
      },
      nextId: state.nextId + 1,
    },
    {
      severity: 'info',
      title: `Upgrading ${serviceName(department, service)}`,
      body: `₹${groupIndian(cost)} crore goes into the ${MINISTRY_CONTENT[department].shortName} department's ${serviceName(department, service).toLowerCase()}. It gains a star in about a month.`,
    },
  );
}

const setStars = (state: GameState, department: MinistryId, service: ServiceId, stars: number): GameState => ({
  ...state,
  departments: {
    ...state.departments,
    stars: { ...state.departments.stars, [department]: { ...state.departments.stars[department], [service]: stars } },
  },
});

/** Daily: upgrades that have run their course add their star. */
export function completeUpgrades(state: GameState): GameState {
  const done = state.departments.upgrades.filter((u) => u.endsTick <= state.clock.tick);
  if (done.length === 0) return state;
  let next: GameState = {
    ...state,
    departments: {
      ...state.departments,
      upgrades: state.departments.upgrades.filter((u) => u.endsTick > state.clock.tick),
    },
  };
  for (const u of done) {
    const stars = Math.min(MAX_STARS, starsOf(next, u.department, u.service) + 1);
    next = appendLog(setStars(next, u.department, u.service, stars), {
      severity: 'good',
      title: `${serviceName(u.department, u.service)}: ${stars} stars`,
      body: `The ${MINISTRY_CONTENT[u.department].shortName} department's ${serviceName(u.department, u.service).toLowerCase()} is now rated ${stars} of ${MAX_STARS}.`,
    });
  }
  return next;
}

/**
 * Monthly: a department funded well below its default for UNDERFUNDED_MONTHS straight months loses a star from
 * its best service. Stars are bought once, but they have to be paid for every month.
 */
export function settleDepartmentFunding(state: GameState): GameState {
  let next = state;
  const months = { ...state.departments.underfundedMonths };
  for (const m of MINISTRIES) {
    months[m] = departmentFunding(state, m) < UNDERFUNDED_BELOW ? months[m] + 1 : 0;
    if (months[m] < UNDERFUNDED_MONTHS) continue;
    months[m] = 0;
    const best = [...DEPARTMENT_SERVICES[m]].sort((a, b) => starsOf(next, m, b) - starsOf(next, m, a))[0] as ServiceId;
    const stars = starsOf(next, m, best);
    if (stars <= MIN_STARS) continue;
    next = appendLog(setStars(next, m, best, stars - 1), {
      severity: 'warning',
      title: `${MINISTRY_CONTENT[m].shortName} is running down`,
      body: `Months of underfunding have cost the ${serviceName(m, best).toLowerCase()} a star (now ${stars - 1} of ${MAX_STARS}). Raise the department's budget to stop the slide.`,
    });
  }
  return { ...next, departments: { ...next.departments, underfundedMonths: months } };
}

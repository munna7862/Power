import type { EffectScale, EventEffect } from '../content/events';
import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, REGIONS, RIVALS, type MinistryId, type RegionId } from '../content/ids';
import { ministryEfficiency } from '../economy/model';
import type { ModifierTarget } from '../engine/modifiers';
import type { Rng } from '../engine/rng';
import { exposeMinister, pickCorruptMinister } from '../cabinet/scandal';
import { addModifier } from '../politics/policy';
import { patchMilitary } from '../military/forces';
import { adjustRelation } from '../military/rivals';
import { launchOperation } from '../security/operations';
import { clamp } from '../security/unrest';
import type { Difficulty, GameState } from '../state/types';

/** How often events happen and how hard their harm lands, by difficulty. */
export const EVENT_DIFFICULTY: Record<Difficulty, { frequency: number; severity: number }> = {
  easy: { frequency: 0.8, severity: 0.85 },
  normal: { frequency: 1, severity: 1 },
  hard: { frequency: 1.25, severity: 1.2 },
};

/** +1 when a larger value is good for the President, −1 when it is bad, 0 when it can go either way. */
const GOOD_DIRECTION: Record<ModifierTarget, 1 | -1 | 0> = {
  'economy.growth': 1,
  'economy.growth.agriculture': 1,
  'economy.growth.industry': 1,
  'economy.growth.services': 1,
  'economy.growth.energy': 1,
  'economy.growth.tech': 1,
  'economy.inflation': -1,
  'economy.unemployment': -1,
  'economy.revenue': 1,
  'economy.expenditure': 0,
  'politics.approvalTarget': 1,
  'politics.corruption': -1,
  'society.hdi': 1,
};

export interface EffectContext {
  rng: Rng;
  /** The region the event is happening in. */
  region: RegionId | null;
  /** Reference carried by the event, e.g. a terror plot id. */
  ref: string | null;
  /** Shown in "Why?" breakdowns for modifiers without their own label. */
  label: string;
}

/**
 * How much a ministry's quality changes an effect. A well-run ministry (efficiency 1.8) shrinks harm
 * to about half; a poorly run one (0.5) makes it about a third worse. "Amplify" does the reverse for benefits.
 */
export function scaleFactor(
  state: Pick<GameState, 'budget' | 'cabinet' | 'modifiers' | 'economy'>,
  scale?: EffectScale,
): number {
  if (!scale) return 1;
  const efficiency = ministryEfficiency(state, scale.ministry);
  return scale.mode === 'mitigate' ? clamp(1.6 - 0.6 * efficiency, 0.4, 1.4) : clamp(0.4 + 0.6 * efficiency, 0.6, 1.4);
}

/** Whether an effect hurts the President, so difficulty can make it bite harder. */
export function isHarmful(effect: EventEffect): boolean {
  switch (effect.type) {
    case 'modifier': {
      const good = GOOD_DIRECTION[effect.target];
      return good !== 0 && Math.sign(effect.value) === -good;
    }
    case 'unrest':
    case 'terror':
    case 'borderTension':
    case 'corruption':
      return effect.delta > 0;
    case 'militaryLoyalty':
    case 'loyalty':
    case 'readiness':
    case 'morale':
    case 'relation':
      return effect.delta < 0;
    default:
      return false;
  }
}

function adjustLoyalty(state: GameState, delta: number, ministry?: MinistryId): GameState {
  const ministers = { ...state.cabinet.ministers };
  for (const m of ministry ? [ministry] : MINISTRIES) {
    const minister = ministers[m];
    if (minister) ministers[m] = { ...minister, loyalty: clamp(minister.loyalty + delta, 0, 100) };
  }
  return { ...state, cabinet: { ...state.cabinet, ministers } };
}

/** Applies one effect. Harmful effects are scaled by the game's difficulty. */
export function applyEffect(state: GameState, effect: EventEffect, ctx: EffectContext): GameState {
  const severity = isHarmful(effect) ? EVENT_DIFFICULTY[state.meta.difficulty].severity : 1;
  switch (effect.type) {
    case 'modifier':
      return addModifier(
        state,
        {
          source: 'event',
          label: effect.label ?? ctx.label,
          target: effect.target,
          kind: effect.kind,
          value: effect.value * severity * scaleFactor(state, effect.scale),
        },
        effect.days,
      );
    case 'treasury':
      return {
        ...state,
        nation: { ...state.nation, treasury: state.nation.treasury + effect.amount * scaleFactor(state, effect.scale) },
      };
    case 'unrest': {
      const delta = effect.delta * severity * scaleFactor(state, effect.scale);
      const regions: readonly RegionId[] = effect.where === 'all' ? REGIONS : ctx.region ? [ctx.region] : [];
      const unrest = { ...state.security.unrest };
      for (const r of regions) unrest[r] = clamp(unrest[r] + delta, 0, 100);
      return { ...state, security: { ...state.security, unrest } };
    }
    case 'terror':
      return {
        ...state,
        security: {
          ...state.security,
          terrorThreat: clamp(
            state.security.terrorThreat + effect.delta * severity * scaleFactor(state, effect.scale),
            0,
            100,
          ),
        },
      };
    case 'borderTension':
      return {
        ...state,
        security: {
          ...state.security,
          borderTension: clamp(state.security.borderTension + effect.delta * severity, 0, 100),
        },
      };
    case 'militaryLoyalty':
      return {
        ...state,
        security: {
          ...state.security,
          militaryLoyalty: clamp(state.security.militaryLoyalty + effect.delta * severity, 0, 100),
        },
      };
    case 'readiness':
      return patchMilitary(state, {
        readiness: clamp(state.military.readiness + effect.delta * severity, 0, 100),
      });
    case 'morale':
      return patchMilitary(state, { morale: clamp(state.military.morale + effect.delta * severity, 0, 100) });
    case 'relation': {
      const rival = effect.rival ?? RIVALS.find((r) => r === ctx.ref);
      return rival ? adjustRelation(state, rival, effect.delta * severity) : state;
    }
    case 'corruption':
      return {
        ...state,
        economy: { ...state.economy, corruption: clamp(state.economy.corruption + effect.delta * severity, 0, 100) },
      };
    case 'loyalty':
      return adjustLoyalty(state, effect.delta * severity, effect.ministry);
    case 'scandal': {
      const ministry = effect.ministry === 'random' ? pickCorruptMinister(state, ctx.rng) : effect.ministry;
      if (!ministry || !state.cabinet.ministers[ministry]) return state;
      return exposeMinister(
        state,
        ministry,
        `Press reports and an internal audit pointed to misuse of funds in the ${MINISTRY_CONTENT[ministry].shortName} ministry.`,
      );
    }
    case 'operation':
      return launchOperation(state, effect.kind, ctx.rng, ctx.ref);
  }
}

export function applyEffects(state: GameState, effects: readonly EventEffect[], ctx: EffectContext): GameState {
  return effects.reduce((s, e) => applyEffect(s, e, ctx), state);
}

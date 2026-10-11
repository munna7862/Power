import type { EffectScale, EventEffect } from '../content/events';
import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, REGIONS, type MinistryId, type RegionId } from '../content/ids';
import { COUNTRY_LIST, isCountryId } from '../content/world';
import { PACT_YEARS } from '../diplomacy/constants';
import { adjustRelation as adjustCountryRelation, hasTreaty } from '../diplomacy/relations';
import { adjustReputation, signTreaty } from '../diplomacy/treaties';
import { startConflict } from '../diplomacy/world';
import { ministryEfficiency } from '../economy/model';
import type { ModifierTarget } from '../engine/modifiers';
import type { Rng } from '../engine/rng';
import { exposeMinister, pickCorruptMinister } from '../cabinet/scandal';
import { addModifier } from '../politics/policy';
import { patchMilitary } from '../military/forces';
import { launchOperation } from '../security/operations';
import { clamp, unrestCeiling } from '../security/unrest';
import { DIFFICULTY_RULES } from '../state/difficulty';
import { DIFFICULTIES, INDIA, type Difficulty, type GameState } from '../state/types';

/** How often events happen and how hard their harm lands, by difficulty (see state/difficulty.ts). */
export const EVENT_DIFFICULTY: Record<Difficulty, { frequency: number; severity: number }> = Object.fromEntries(
  DIFFICULTIES.map((d) => [
    d,
    { frequency: DIFFICULTY_RULES[d].eventFrequency, severity: DIFFICULTY_RULES[d].eventSeverity },
  ]),
) as Record<Difficulty, { frequency: number; severity: number }>;

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
  'economy.customs': 1,
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
    case 'worldRelation':
    case 'reputation':
      return effect.delta < 0;
    case 'worldTension':
      return effect.delta > 0;
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
      for (const r of regions) unrest[r] = clamp(unrest[r] + delta, 0, unrestCeiling(state));
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
      const country = effect.country ?? ctx.ref;
      return country && isCountryId(country) ? adjustCountryRelation(state, country, effect.delta * severity) : state;
    }
    case 'worldRelation': {
      const delta = effect.delta * severity;
      const countries = { ...state.diplomacy.countries };
      for (const c of COUNTRY_LIST) {
        if (effect.scope === 'focus' && !c.focus) continue;
        if (effect.scope === 'neighbours' && !c.neighbour) continue;
        const current = countries[c.id];
        if (current) countries[c.id] = { ...current, relation: clamp(current.relation + delta, -100, 100) };
      }
      return { ...state, diplomacy: { ...state.diplomacy, countries } };
    }
    case 'reputation':
      return adjustReputation(state, effect.delta * severity);
    case 'worldTension':
      return {
        ...state,
        diplomacy: {
          ...state.diplomacy,
          worldTension: clamp(state.diplomacy.worldTension + effect.delta * severity, 0, 100),
        },
      };
    case 'conflict':
      return startConflict(state, ctx.ref, effect.days, ctx.rng);
    case 'treaty': {
      const country = ctx.ref;
      if (!country || !isCountryId(country) || hasTreaty(state, country, effect.kind)) return state;
      if (effect.kind === 'embassy' && state.diplomacy.countries[country]?.embassy) return state;
      const years =
        effect.kind === 'nonAggression' ? effect.years || PACT_YEARS : effect.kind === 'embassy' ? null : effect.years;
      return signTreaty(state, { type: effect.kind, parties: [INDIA, country], years });
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

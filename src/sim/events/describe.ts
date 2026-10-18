import { EVENT_CONTENT, type EventChoice, type EventContent, type EventEffect } from '../content/events';
import { COUNTRY_CONTENT } from '../content/world';
import type { RegionId } from '../content/ids';
import { eventPlace } from '../national/split';
import type { ModifierTarget } from '../engine/modifiers';
import { groupIndian } from '../engine/numberFormat';
import { OPERATIONS } from '../security/constants';
import type { GameState, PendingEvent } from '../state/types';
import { EVENT_DIFFICULTY, isHarmful, scaleFactor } from './effects';
import { fillText, renderEventText } from './engine';

export interface EffectLine {
  text: string;
  /** Whether the effect is good or bad for the President, for colouring. */
  tone: 'good' | 'bad' | 'neutral';
}

const signed = (v: number, digits = 1) => {
  const rounded = Number(v.toFixed(digits));
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)}`;
};

const duration = (days: number | null) => {
  if (days === null) return 'permanently';
  if (days >= 330) return 'for a year';
  if (days >= 60) return `for about ${Math.round(days / 30)} months`;
  return `for ${days} days`;
};

/** How a modifier target reads in a sentence, how to display its value and which direction is good. */
const TARGET_LABELS: Record<ModifierTarget, { label: string; unit: 'pts' | 'pct' | 'raw'; good: 1 | -1 | 0 }> = {
  'economy.growth': { label: 'Growth', unit: 'pts', good: 1 },
  'economy.growth.agriculture': { label: 'Agriculture growth', unit: 'pts', good: 1 },
  'economy.growth.industry': { label: 'Industry growth', unit: 'pts', good: 1 },
  'economy.growth.services': { label: 'Services growth', unit: 'pts', good: 1 },
  'economy.growth.energy': { label: 'Energy growth', unit: 'pts', good: 1 },
  'economy.growth.tech': { label: 'Tech growth', unit: 'pts', good: 1 },
  'economy.inflation': { label: 'Inflation', unit: 'pts', good: -1 },
  'economy.unemployment': { label: 'Unemployment', unit: 'pts', good: -1 },
  'economy.revenue': { label: 'Government revenue', unit: 'pct', good: 1 },
  'economy.customs': { label: 'Customs revenue', unit: 'pct', good: 1 },
  'economy.expenditure': { label: 'Ministry spending power', unit: 'pct', good: 0 },
  'politics.approvalTarget': { label: 'Approval', unit: 'raw', good: 1 },
  'politics.corruption': { label: 'Corruption', unit: 'raw', good: -1 },
  'society.hdi': { label: 'Human development', unit: 'pts', good: 1 },
};

const toneOf = (good: number, value: number): EffectLine['tone'] =>
  good === 0 || value === 0 ? 'neutral' : Math.sign(value) === good ? 'good' : 'bad';

/** The effect as the player will experience it: scaled by ministry quality and difficulty. */
export function describeEffect(
  state: GameState,
  effect: EventEffect,
  region: RegionId | null,
  relationTarget = 'the other country',
): EffectLine {
  const severity = isHarmful(effect) ? EVENT_DIFFICULTY[state.meta.difficulty].severity : 1;
  switch (effect.type) {
    case 'modifier': {
      const spec = TARGET_LABELS[effect.target];
      const value = effect.value * severity * scaleFactor(state, effect.scale);
      const percent = effect.kind === 'mult' || spec.unit === 'pct';
      const shown = spec.unit === 'raw' && !percent ? value : value * 100;
      return {
        text: `${spec.label} ${signed(shown, spec.unit === 'raw' && !percent ? 1 : 2)}${percent ? '%' : ' pts'} ${duration(effect.days)}`,
        tone: toneOf(spec.good, value),
      };
    }
    case 'treasury': {
      const amount = effect.amount * scaleFactor(state, effect.scale);
      return {
        text: `${amount >= 0 ? 'Windfall' : 'Costs'} ₹${groupIndian(Math.abs(Math.round(amount)))} crore`,
        tone: amount >= 0 ? 'good' : 'bad',
      };
    }
    case 'unrest': {
      const delta = effect.delta * severity * scaleFactor(state, effect.scale);
      const where = effect.where === 'all' ? 'nationwide' : `in ${region ? eventPlace(state, region) : 'the region'}`;
      return { text: `Unrest ${signed(delta, 0)} ${where}`, tone: delta > 0 ? 'bad' : 'good' };
    }
    case 'terror': {
      const delta = effect.delta * severity * scaleFactor(state, effect.scale);
      return { text: `Terror threat ${signed(delta, 0)}`, tone: delta > 0 ? 'bad' : 'good' };
    }
    case 'borderTension':
      return {
        text: `Border tension ${signed(effect.delta * severity, 0)}`,
        tone: effect.delta > 0 ? 'bad' : 'good',
      };
    case 'militaryLoyalty':
      return {
        text: `Army loyalty ${signed(effect.delta * severity, 0)}`,
        tone: effect.delta > 0 ? 'good' : 'bad',
      };
    case 'readiness':
      return {
        text: `Military readiness ${signed(effect.delta * severity, 0)}`,
        tone: effect.delta > 0 ? 'good' : 'bad',
      };
    case 'morale':
      return { text: `Troop morale ${signed(effect.delta * severity, 0)}`, tone: effect.delta > 0 ? 'good' : 'bad' };
    case 'relation': {
      const country = effect.country ? (COUNTRY_CONTENT[effect.country]?.name ?? effect.country) : relationTarget;
      return {
        text: `Relations with ${country} ${signed(effect.delta * severity, 0)}`,
        tone: effect.delta > 0 ? 'good' : 'bad',
      };
    }
    case 'worldRelation': {
      const who =
        effect.scope === 'focus' ? 'major powers' : effect.scope === 'neighbours' ? 'neighbours' : 'the world';
      return {
        text: `Relations with ${who} ${signed(effect.delta * severity, 0)}`,
        tone: effect.delta > 0 ? 'good' : 'bad',
      };
    }
    case 'reputation':
      return {
        text: `India’s reputation ${signed(effect.delta * severity, 0)}`,
        tone: effect.delta > 0 ? 'good' : 'bad',
      };
    case 'worldTension':
      return { text: `World tension ${signed(effect.delta * severity, 0)}`, tone: effect.delta > 0 ? 'bad' : 'good' };
    case 'conflict':
      return { text: 'A regional conflict spreads on the world map', tone: 'neutral' };
    case 'treaty':
      return {
        text:
          effect.kind === 'trade'
            ? 'A trade agreement is signed'
            : effect.kind === 'embassy'
              ? 'An embassy is opened'
              : 'A non-aggression pact is signed',
        tone: 'good',
      };
    case 'corruption':
      return {
        text: `Corruption ${signed(effect.delta * severity, 0)} points`,
        tone: effect.delta > 0 ? 'bad' : 'good',
      };
    case 'operation':
      return { text: `${OPERATIONS[effect.kind].label} (operation)`, tone: 'good' };
  }
}

/** A rough "approval-equivalent" value of an effect, used by bots to rank choices. */
export function effectUtility(state: GameState, effect: EventEffect): number {
  const severity = isHarmful(effect) ? EVENT_DIFFICULTY[state.meta.difficulty].severity : 1;
  switch (effect.type) {
    case 'modifier': {
      const value = effect.value * severity * scaleFactor(state, effect.scale);
      const years = Math.min(effect.days ?? 730, 730) / 365;
      const good = TARGET_LABELS[effect.target].good;
      if (effect.target === 'politics.approvalTarget') return (value * Math.min(effect.days ?? 180, 180)) / 90;
      if (effect.target === 'politics.corruption') return -value * years * 0.5;
      return good === 0 ? 0 : value * 100 * years * 3 * good;
    }
    case 'treasury':
      return (effect.amount * scaleFactor(state, effect.scale)) / 2500;
    case 'unrest':
      return -effect.delta * severity * scaleFactor(state, effect.scale) * 0.15;
    case 'terror':
      return -effect.delta * severity * scaleFactor(state, effect.scale) * 0.2;
    case 'borderTension':
      return -effect.delta * 0.1;
    case 'militaryLoyalty':
      return effect.delta * 0.15;
    case 'readiness':
    case 'morale':
      return effect.delta * 0.12;
    case 'relation':
      return effect.delta * 0.08;
    case 'worldRelation':
      return effect.delta * 0.12;
    case 'reputation':
      return effect.delta * 0.15;
    case 'worldTension':
      return -effect.delta * 0.08;
    case 'conflict':
      return -1;
    case 'treaty':
      return 2;
    case 'corruption':
      return -effect.delta * 0.5;
    case 'operation':
      return effect.kind === 'raid' ? 3 : 2;
  }
}

export function choiceUtility(state: GameState, choice: EventChoice): number {
  return choice.effects.reduce((sum, e) => sum + effectUtility(state, e), 0) - choice.cost / 2500;
}

const rivalName = (ref: string | null): string =>
  ref && ref in COUNTRY_CONTENT ? (COUNTRY_CONTENT[ref]?.name ?? 'the other country') : 'the other country';

export interface PendingView {
  pending: PendingEvent;
  def: EventContent;
  title: string;
  body: string;
  choices: { choice: EventChoice; lines: EffectLine[] }[];
  /** Whole days left to decide. */
  daysLeft: number;
}

/** Everything the UI needs to show a pending decision. Null for decisions whose content no longer exists. */
export function pendingView(state: GameState, pending: PendingEvent): PendingView | null {
  const def = EVENT_CONTENT[pending.eventId];
  if (!def) return null;
  const { title, body } = renderEventText(state, def, pending.region, pending.ref);
  return {
    pending,
    def,
    title,
    body,
    choices: def.choices.map((choice) => ({
      choice: {
        ...choice,
        label: fillText(state, choice.label, pending.region, pending.ref),
        description: fillText(state, choice.description, pending.region, pending.ref),
      },
      lines: choice.effects.map((e) => describeEffect(state, e, pending.region, rivalName(pending.ref))),
    })),
    daysLeft: Math.max(0, pending.expiresTick - state.clock.tick),
  };
}

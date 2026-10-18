import type { Modifier } from '../engine/modifiers';
import type { Difficulty, GameState } from './types';

/**
 * Everything that changes with the difficulty, in one table, so Easy, Normal and Hard differ in ways the
 * player can read: money and goodwill at the start, how often trouble arrives and how hard it lands,
 * how warlike the neighbours are, and how much approval it takes to survive and to win.
 */
export interface DifficultyRules {
  /** Opening treasury, ₹ crore. */
  treasury: number;
  /** Opening approval, %. */
  approval: number;
  /** Permanent modifiers, shown in the "Why?" tooltips with the source "difficulty". */
  modifiers: Omit<Modifier, 'id'>[];
  /** Multiplies the daily chance of every random event. */
  eventFrequency: number;
  /** Multiplies the harm of event effects (benefits are never scaled). */
  eventSeverity: number;
  /** Multiplies every rival's monthly chance of declaring war on India. */
  warChance: number;
  /**
   * Approval needed on election day, at the end of the term, to win a second term. The same on every
   * difficulty (a clear mandate); the difficulties differ in how hard it is to get there.
   */
  reelectionApproval: number;
  /** Approval-target points lost for each full year in office after the first (voter fatigue), up to four years. */
  voterFatigue: number;
  /** Approval below which Parliament starts counting the months toward impeachment. */
  impeachmentThreshold: number;
}

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  easy: {
    treasury: 320_000,
    approval: 62,
    modifiers: [
      {
        source: 'difficulty',
        label: 'Difficulty: Easy',
        target: 'economy.revenue',
        kind: 'mult',
        value: 0.04,
        expiresAtTick: null,
      },
    ],
    eventFrequency: 0.8,
    eventSeverity: 0.85,
    warChance: 0.5,
    reelectionApproval: 55,
    voterFatigue: 2,
    impeachmentThreshold: 12,
  },
  normal: {
    treasury: 220_000,
    approval: 55,
    modifiers: [],
    eventFrequency: 1,
    eventSeverity: 1,
    warChance: 1,
    reelectionApproval: 58,
    voterFatigue: 6,
    impeachmentThreshold: 15,
  },
  hard: {
    treasury: 140_000,
    approval: 48,
    modifiers: [
      {
        source: 'difficulty',
        label: 'Difficulty: Hard',
        target: 'economy.revenue',
        kind: 'mult',
        value: -0.03,
        expiresAtTick: null,
      },
      {
        source: 'difficulty',
        label: 'Difficulty: Hard',
        target: 'politics.approvalTarget',
        kind: 'add',
        value: -2.5,
        expiresAtTick: null,
      },
    ],
    eventFrequency: 1.25,
    eventSeverity: 1.2,
    warChance: 1.5,
    reelectionApproval: 58,
    voterFatigue: 6,
    impeachmentThreshold: 18,
  },
};

export const rulesFor = (state: Pick<GameState, 'meta'>): DifficultyRules => DIFFICULTY_RULES[state.meta.difficulty];

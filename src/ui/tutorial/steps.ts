import { TUTORIAL_EVENT, type GameState } from '../../sim';
import type { Speed, ViewId } from '../../store';

/**
 * The guided tutorial for the first month in office. Each step names what to highlight and when it is done:
 * on "Next", or as soon as the player does the thing it asks (opens a screen, starts the clock, answers the
 * practice decision the simulation schedules for day 4 when the tutorial is on).
 */
export type TutorialTarget = ViewId | 'speed' | 'decisions' | 'handbook';

export type Advance =
  | { kind: 'next' }
  | { kind: 'view'; view: ViewId }
  | { kind: 'clockRunning' }
  | { kind: 'decisionArrived' }
  | { kind: 'decisionMade' };

export const TUTORIAL_STEP_IDS = [
  'welcome',
  'approval',
  'budget',
  'budgetExplain',
  'departments',
  'departmentsExplain',
  'construction',
  'constructionExplain',
  'clock',
  'decisionWait',
  'decisionMake',
  'world',
  'advisor',
  'handbook',
  'done',
] as const;
export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

/** Steps that wait for the player to act; only these have a "hint" line in i18n. */
export type WaitingStepId =
  'budget' | 'departments' | 'construction' | 'clock' | 'decisionWait' | 'decisionMake' | 'world';

export interface TutorialStep {
  id: TutorialStepId;
  target: TutorialTarget | null;
  advance: Advance;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'welcome', target: null, advance: { kind: 'next' } },
  { id: 'approval', target: 'dashboard', advance: { kind: 'next' } },
  { id: 'budget', target: 'budget', advance: { kind: 'view', view: 'budget' } },
  { id: 'budgetExplain', target: null, advance: { kind: 'next' } },
  { id: 'departments', target: 'departments', advance: { kind: 'view', view: 'departments' } },
  { id: 'departmentsExplain', target: null, advance: { kind: 'next' } },
  { id: 'construction', target: 'construction', advance: { kind: 'view', view: 'construction' } },
  { id: 'constructionExplain', target: null, advance: { kind: 'next' } },
  { id: 'clock', target: 'speed', advance: { kind: 'clockRunning' } },
  { id: 'decisionWait', target: 'speed', advance: { kind: 'decisionArrived' } },
  { id: 'decisionMake', target: 'decisions', advance: { kind: 'decisionMade' } },
  { id: 'world', target: 'world', advance: { kind: 'view', view: 'world' } },
  { id: 'advisor', target: 'dashboard', advance: { kind: 'next' } },
  { id: 'handbook', target: 'handbook', advance: { kind: 'next' } },
  { id: 'done', target: null, advance: { kind: 'next' } },
];

export interface TutorialContext {
  game: GameState;
  view: ViewId;
  speed: Speed;
}

const tutorialPending = (game: GameState) => game.events.pending.some((p) => p.eventId === TUTORIAL_EVENT);

/** Whether the player has done what a step asks (steps that wait for "Next" are never done by themselves). */
export function stepDone(step: TutorialStep, { game, view, speed }: TutorialContext): boolean {
  switch (step.advance.kind) {
    case 'next':
      return false;
    case 'view':
      return view === step.advance.view;
    case 'clockRunning':
      return speed > 0 || game.clock.tick > 0;
    case 'decisionArrived':
      return tutorialPending(game);
    case 'decisionMade':
      return !tutorialPending(game);
  }
}

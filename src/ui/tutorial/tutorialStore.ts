import { create } from 'zustand';
import { useSettings } from '../../store/settingsStore';
import { TUTORIAL_STEPS } from './steps';

interface TutorialState {
  active: boolean;
  /** Index into TUTORIAL_STEPS. */
  step: number;
  start(): void;
  next(): void;
  /** Ends the tutorial early or at the last step; either way New Game stops ticking it by default. */
  end(): void;
}

export const useTutorial = create<TutorialState>()((set, get) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  next: () => {
    const step = get().step + 1;
    if (step >= TUTORIAL_STEPS.length) get().end();
    else set({ step });
  },
  end: () => {
    set({ active: false, step: 0 });
    useSettings.getState().update({ tutorialSeen: true });
  },
}));

/** The highlighted element of the current step, if any (for data-tutorial attributes). */
export const useTutorialTarget = () => useTutorial((s) => (s.active ? (TUTORIAL_STEPS[s.step]?.target ?? null) : null));

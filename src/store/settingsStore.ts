import { create } from 'zustand';
import { loadSettings, saveSettings, type Settings } from '../platform/settings';

interface SettingsState extends Settings {
  /** Changes one or more preferences and persists them. */
  update(patch: Partial<Settings>): void;
  setTheme(theme: Settings['theme']): void;
}

const pick = (s: SettingsState): Settings => ({
  theme: s.theme,
  uiScale: s.uiScale,
  palette: s.palette,
  motion: s.motion,
  musicVolume: s.musicVolume,
  sfxVolume: s.sfxVolume,
  muted: s.muted,
  tutorialSeen: s.tutorialSeen,
});

export const useSettings = create<SettingsState>()((set, get) => ({
  ...loadSettings(),
  update: (patch) => {
    set(patch);
    saveSettings(pick(get()));
  },
  setTheme: (theme) => get().update({ theme }),
}));

import { create } from 'zustand';
import { loadSettings, saveSettings, type Theme } from '../platform/settings';

interface SettingsState {
  theme: Theme;
  setTheme(theme: Theme): void;
}

export const useSettings = create<SettingsState>()((set) => ({
  theme: loadSettings().theme,
  setTheme: (theme) => {
    saveSettings({ theme });
    set({ theme });
  },
}));

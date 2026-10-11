/** Per-player preferences. Unlike saves, these are best-effort and never block the game. */
export type Theme = 'dark' | 'light';

export interface Settings {
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'dark' };

const KEY = 'india-apex-sovereign:settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { theme: parsed.theme === 'light' ? 'light' : 'dark' };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Preferences are a convenience; failing to persist them is not an error.
  }
}

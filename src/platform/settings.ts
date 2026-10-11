/** Per-player preferences. Unlike saves, these are best-effort and never block the game. */
export type Theme = 'dark' | 'light';
/** "colourBlind" swaps red/green signals for a blue/orange palette that reads with every common colour deficiency. */
export type Palette = 'standard' | 'colourBlind';
/** "system" follows the operating system's reduced-motion setting. */
export type Motion = 'system' | 'reduced' | 'full';

export const UI_SCALES = [90, 100, 110, 125, 150] as const;
export type UiScale = (typeof UI_SCALES)[number];

export interface Settings {
  theme: Theme;
  /** Interface size in percent. */
  uiScale: UiScale;
  palette: Palette;
  motion: Motion;
  /** 0–1 each. */
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** The player has finished or skipped the tutorial once, so New Game stops ticking it by default. */
  tutorialSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  uiScale: 100,
  palette: 'standard',
  motion: 'system',
  musicVolume: 0.4,
  sfxVolume: 0.7,
  muted: false,
  tutorialSeen: false,
};

const KEY = 'india-apex-sovereign:settings';

const oneOf = <T extends string | number>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const volume = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/** Validates stored preferences field by field, so one bad value never resets the rest. */
export function sanitizeSettings(raw: unknown): Settings {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: oneOf(p.theme, ['dark', 'light'], d.theme),
    uiScale: oneOf(p.uiScale, UI_SCALES, d.uiScale),
    palette: oneOf(p.palette, ['standard', 'colourBlind'], d.palette),
    motion: oneOf(p.motion, ['system', 'reduced', 'full'], d.motion),
    musicVolume: volume(p.musicVolume, d.musicVolume),
    sfxVolume: volume(p.sfxVolume, d.sfxVolume),
    muted: typeof p.muted === 'boolean' ? p.muted : d.muted,
    tutorialSeen: typeof p.tutorialSeen === 'boolean' ? p.tutorialSeen : d.tutorialSeen,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
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

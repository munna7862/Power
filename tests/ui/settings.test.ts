import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../src/platform/settings';

describe('player settings', () => {
  it('fill in defaults for anything missing or unreadable', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keep valid values and replace invalid ones field by field', () => {
    const settings = sanitizeSettings({
      theme: 'light',
      uiScale: 125,
      palette: 'colourBlind',
      motion: 'neon',
      musicVolume: 3,
      sfxVolume: -1,
      muted: 'yes',
      tutorialSeen: true,
    });
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      uiScale: 125,
      palette: 'colourBlind',
      musicVolume: 1,
      sfxVolume: 0,
      tutorialSeen: true,
    });
    expect(sanitizeSettings({ uiScale: 133 }).uiScale).toBe(100);
  });
});

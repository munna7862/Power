import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';

/**
 * UI text lives in src/ui/i18n/<language>/*.json, never in components (the `apex/no-ui-literals` lint rule
 * enforces this). English ships with v1; Hindi follows in Phase 7. Simulation text (event content, inbox
 * entries, "Why?" labels) is still English and comes from the simulation and /content.
 */
export const LANGUAGES = ['en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const resources = { en: { translation: en } } as const;

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
export const t = i18n.t.bind(i18n);

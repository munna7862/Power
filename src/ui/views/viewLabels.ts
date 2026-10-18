import type { ViewId } from '../../store';

/** The screens in navigation order (labels live in i18n under nav.views; shortcuts are in shortcuts.ts). */
export const VIEWS: readonly ViewId[] = [
  'dashboard',
  'inbox',
  'economy',
  'budget',
  'departments',
  'construction',
  'security',
  'military',
  'world',
  'diplomacy',
  'reports',
];

import type { ViewId } from '../../store';

/** The screens in navigation order (labels live in i18n under nav.views; F1–F10 follow this order). */
export const VIEWS: readonly ViewId[] = [
  'dashboard',
  'inbox',
  'economy',
  'budget',
  'departments',
  'security',
  'military',
  'world',
  'diplomacy',
  'reports',
];

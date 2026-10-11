import type { ViewId } from '../../store';

export const VIEW_LABELS: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  inbox: 'Inbox',
  economy: 'Economy',
  budget: 'Budget',
  cabinet: 'Cabinet',
  security: 'Security',
  military: 'Military',
  world: 'World',
  reports: 'Reports',
};

export const VIEWS = Object.keys(VIEW_LABELS) as ViewId[];

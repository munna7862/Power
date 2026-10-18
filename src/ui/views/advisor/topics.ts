import {
  GOOD_CONTENT,
  INTL_LENDER,
  lenderName,
  MINISTRY_CONTENT,
  type Advice,
  type ApprovalFactor,
} from '../../../sim';
import type { ViewId } from '../../../store';
import { pct } from '../../format';
import { t } from '../../i18n';

const FACTOR_VIEWS: Record<ApprovalFactor, ViewId> = {
  jobs: 'economy',
  prices: 'economy',
  growth: 'economy',
  corruption: 'departments',
  livingStandards: 'construction',
  taxes: 'budget',
  services: 'construction',
  safety: 'security',
};

/** The screen that fixes a warning. */
export function adviceView(advice: Advice): ViewId {
  switch (advice.topic) {
    case 'approval':
      return advice.factor ? FACTOR_VIEWS[advice.factor] : 'dashboard';
    case 'department':
    case 'debt':
      return 'budget';
    case 'power':
      return 'energy';
    case 'shortage':
      return 'industry';
    case 'coverage':
      return 'construction';
    case 'police':
      return 'police';
    case 'unrest':
      return 'security';
    case 'forces':
      return 'military';
    case 'loan':
      return 'finance';
  }
}

/** The warning in words. In national play the region is left out: the President acts for all of India. */
export function adviceText(advice: Advice, regional = true): string {
  const region = advice.region ? t(`regions.${advice.region}`) : '';
  const national = !regional && advice.region !== undefined;
  switch (advice.topic) {
    case 'approval':
      return t('advisor.topics.approval', {
        factor: advice.factor ? t(`dashboard.factors.${advice.factor}`).toLowerCase() : '',
        value: Math.round(advice.value),
      });
    case 'department':
      return t('advisor.topics.department', {
        department: advice.department ? MINISTRY_CONTENT[advice.department].shortName : '',
        value: pct(advice.value, 0),
      });
    case 'power':
      return t('advisor.topics.power', { value: pct(1 - advice.value, 0) });
    case 'shortage':
      return t('advisor.topics.shortage', {
        good: advice.good ? GOOD_CONTENT[advice.good].name : '',
        value: pct(advice.value, 0),
      });
    case 'coverage':
      return t(national ? 'advisor.topics.coverageNational' : 'advisor.topics.coverage', {
        region,
        area: advice.area ? t(`construction.areas.${advice.area}`).toLowerCase() : '',
        value: pct(advice.value, 0),
      });
    case 'police':
      return t(national ? 'advisor.topics.policeNational' : 'advisor.topics.police', {
        region,
        value: pct(advice.value, 0),
      });
    case 'unrest':
      return t(national ? 'advisor.topics.unrestNational' : 'advisor.topics.unrest', {
        region,
        value: Math.round(advice.value),
      });
    case 'forces':
      return t('advisor.topics.forces', { value: pct(advice.value, 0) });
    case 'loan':
      return t('advisor.topics.loan', {
        lender: !advice.lender || advice.lender === INTL_LENDER ? t('finance.intl') : lenderName(advice.lender),
        count: Math.max(0, advice.value),
      });
    case 'debt':
      return t('advisor.topics.debt', { value: pct(advice.value, 0) });
  }
}

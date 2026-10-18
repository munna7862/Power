import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allEfficiencies,
  allocationBounds,
  announcementEffect,
  approvalTarget,
  computeSatisfaction,
  employmentTaxFactor,
  formatDate,
  MAX_TAX_STEP,
  MINISTRIES,
  MINISTRY_CONTENT,
  nextBudgetDate,
  nominalGdp,
  projectMonth,
  TAX_LIMITS,
  TAXES,
  type BudgetProposal,
  type GameState,
  type TaxId,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { CompareBars } from '../charts/CompareBars';
import { Button, Panel } from '../design/primitives';
import { formatCrore, formatPercent, pct, signed } from '../format';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

/** Snaps to the slider step and strips floating-point dust (0.12999… → 0.13) so bounds land on the step grid. */
const round = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(6));

function longRunApproval(game: GameState, proposal: BudgetProposal): number {
  const state = { ...game, budget: { ...game.budget, ...proposal } };
  return approvalTarget(state, computeSatisfaction(state, allEfficiencies(state))).total;
}

type RowId =
  TaxId | 'nonTax' | 'totalRevenue' | 'ministries' | 'establishment' | 'interest' | 'totalSpending' | 'balance';

export function BudgetView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [draft, setDraft] = useState<BudgetProposal | null>(null);
  if (!game) return null;

  const current: BudgetProposal = { taxRates: game.budget.taxRates, allocations: game.budget.allocations };
  const proposal = draft ?? current;
  const gdp = nominalGdp(game.economy);
  const before = projectMonth(game, current);
  const after = projectMonth(game, proposal);
  const changed =
    TAXES.some((x) => Math.abs(proposal.taxRates[x] - current.taxRates[x]) > 1e-9) ||
    MINISTRIES.some((m) => Math.abs(proposal.allocations[m] - current.allocations[m]) > 1e-12);
  const nextDate = nextBudgetDate(game);
  const shortTerm = announcementEffect(current.taxRates, proposal.taxRates);
  const longTerm = longRunApproval(game, proposal) - longRunApproval(game, current);

  const setTax = (tax: TaxId, value: number) =>
    setDraft({ ...proposal, taxRates: { ...proposal.taxRates, [tax]: value } });
  const setAllocation = (ministry: (typeof MINISTRIES)[number], multiple: number) =>
    setDraft({
      ...proposal,
      allocations: { ...proposal.allocations, [ministry]: MINISTRY_CONTENT[ministry].defaultAllocation * multiple },
    });

  const enact = () => {
    if (gameStore.getState().dispatch({ type: 'ENACT_BUDGET', proposal })) setDraft(null);
  };

  const rows: { id: RowId; now: number; next: number; tone?: boolean }[] = [
    ...TAXES.map((x) => ({ id: x, now: before.revenue[x], next: after.revenue[x] })),
    { id: 'nonTax', now: before.revenue.nonTax, next: after.revenue.nonTax },
    { id: 'totalRevenue', now: before.totalRevenue, next: after.totalRevenue },
    {
      id: 'ministries',
      now: MINISTRIES.reduce((s, m) => s + before.expenditure[m], 0),
      next: MINISTRIES.reduce((s, m) => s + after.expenditure[m], 0),
    },
    { id: 'establishment', now: before.expenditure.establishment, next: after.expenditure.establishment },
    { id: 'interest', now: before.expenditure.interest, next: after.expenditure.interest },
    { id: 'totalSpending', now: before.totalExpenditure, next: after.totalExpenditure },
    { id: 'balance', now: before.balance, next: after.balance, tone: true },
  ];

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.budget')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('budget.subtitle', { step: Math.round(MAX_TAX_STEP * 100) })}</p>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Panel title={t('budget.taxes')} className={gameStyles.span8}>
          <div className={styles.sliders}>
            {/* Customs is set per good on the Trade Market screen (tariffs) since Phase 8. */}
            {TAXES.filter((x) => x !== 'customs').map((x) => {
              const min = round(Math.max(TAX_LIMITS[x].min, current.taxRates[x] - MAX_TAX_STEP), 0.005);
              const max = round(Math.min(TAX_LIMITS[x].max, current.taxRates[x] + MAX_TAX_STEP), 0.005);
              const value = proposal.taxRates[x];
              const moved = Math.abs(value - current.taxRates[x]) > 1e-9;
              const name = t(`budget.rows.${x}`);
              return (
                <label key={x} className={styles.slider}>
                  <span className={styles.sliderLabel}>{name}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.005}
                    value={value}
                    aria-label={name}
                    onChange={(e) => setTax(x, round(Number(e.target.value), 0.005))}
                  />
                  <span className={`${styles.sliderValue} ${moved ? styles.changed : ''}`}>
                    {pct(value)}
                    <span className={styles.sliderHint}>
                      {t('budget.legal', { min: pct(TAX_LIMITS[x].min, 0), max: pct(TAX_LIMITS[x].max, 0) })}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className={styles.note}>{t('budget.customsMoved')}</p>
          <p className={styles.note} data-testid="income-tax-jobs">
            {t('budget.incomeTaxJobs', {
              change: formatPercent(employmentTaxFactor(game.economy.unemployment) - 1),
              unemployment: pct(game.economy.unemployment),
            })}
          </p>
        </Panel>

        <Panel title={t('budget.projected')} className={gameStyles.span4}>
          <div className={styles.projection} data-testid="projection">
            <span className={styles.projectionHead}>{t('budget.item')}</span>
            <span className={styles.projectionHead}>{t('budget.now')}</span>
            <span className={styles.projectionHead}>{t('budget.proposed')}</span>
            {rows.map((r) => (
              <span key={r.id} style={{ display: 'contents' }}>
                <span>{t(`budget.rows.${r.id}`)}</span>
                <span className={styles.num}>{formatCrore(r.now)}</span>
                <span
                  className={`${styles.num} ${r.tone ? (r.next >= 0 ? styles.positive : styles.negative) : ''}`}
                  data-testid={r.tone ? 'projected-balance' : undefined}
                >
                  {formatCrore(r.next)}
                </span>
              </span>
            ))}
            <span>{t('budget.deficit')}</span>
            <span className={styles.num}>{pct(-before.balanceToGdp)}</span>
            <span className={styles.num}>{pct(-after.balanceToGdp)}</span>
          </div>
          <p className={styles.note}>{t('budget.approval', { now: signed(shortTerm), later: signed(longTerm) })}</p>
        </Panel>

        <Panel title={t('budget.funding')} className={gameStyles.span8}>
          <div className={styles.sliders}>
            {MINISTRIES.map((m) => {
              const { min, max } = allocationBounds(m);
              const d = MINISTRY_CONTENT[m].defaultAllocation;
              const multiple = proposal.allocations[m] / d;
              const moved = Math.abs(proposal.allocations[m] - current.allocations[m]) > 1e-12;
              return (
                <label key={m} className={styles.slider} title={MINISTRY_CONTENT[m].role}>
                  <span className={styles.sliderLabel}>{MINISTRY_CONTENT[m].shortName}</span>
                  <input
                    type="range"
                    min={min / d}
                    max={max / d}
                    step={0.05}
                    value={multiple}
                    aria-label={t('budget.fundingOf', { ministry: MINISTRY_CONTENT[m].shortName })}
                    onChange={(e) => setAllocation(m, round(Number(e.target.value), 0.05))}
                  />
                  <span className={`${styles.sliderValue} ${moved ? styles.changed : ''}`}>
                    {Math.round(multiple * 100)}%
                    <span className={styles.sliderHint}>
                      {t('budget.perYear', { value: formatCrore(proposal.allocations[m] * gdp) })}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Panel>

        <Panel title={t('budget.spendingPerYear')} className={gameStyles.span4}>
          <CompareBars
            rows={MINISTRIES.map((m) => ({
              label: MINISTRY_CONTENT[m].shortName,
              current: current.allocations[m] * gdp,
              proposed: proposal.allocations[m] * gdp,
            }))}
            format={formatCrore}
          />
        </Panel>

        <div className={`${gameStyles.span12} ${styles.actions}`}>
          {nextDate && <span className={styles.note}>{t('budget.nextDate', { date: formatDate(nextDate) })}</span>}
          <Button disabled={!changed} onClick={() => setDraft(null)}>
            {t('budget.reset')}
          </Button>
          <Button variant="primary" disabled={!changed || nextDate !== null} onClick={enact}>
            {t('budget.enact')}
          </Button>
        </div>
      </div>
    </>
  );
}

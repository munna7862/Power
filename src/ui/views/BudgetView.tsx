import { useState } from 'react';
import {
  allEfficiencies,
  allocationBounds,
  announcementEffect,
  approvalTarget,
  computeSatisfaction,
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
import { formatCrore, pct, signed } from '../format';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

const TAX_LABELS: Record<TaxId, string> = {
  income: 'Income tax',
  corporate: 'Corporate tax',
  gst: 'GST',
  customs: 'Customs duty',
};

/** Snaps to the slider step and strips floating-point dust (0.12999… → 0.13) so bounds land on the step grid. */
const round = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(6));

function longRunApproval(game: GameState, proposal: BudgetProposal): number {
  const state = { ...game, budget: { ...game.budget, ...proposal } };
  return approvalTarget(state, computeSatisfaction(state, allEfficiencies(state))).total;
}

export function BudgetView() {
  const game = useGame((s) => s.game);
  const [draft, setDraft] = useState<BudgetProposal | null>(null);
  if (!game) return null;

  const current: BudgetProposal = { taxRates: game.budget.taxRates, allocations: game.budget.allocations };
  const proposal = draft ?? current;
  const gdp = nominalGdp(game.economy);
  const before = projectMonth(game, current);
  const after = projectMonth(game, proposal);
  const changed =
    TAXES.some((t) => Math.abs(proposal.taxRates[t] - current.taxRates[t]) > 1e-9) ||
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

  const rows: { label: string; now: number; next: number; tone?: boolean }[] = [
    ...TAXES.map((t) => ({ label: TAX_LABELS[t], now: before.revenue[t], next: after.revenue[t] })),
    { label: 'Non-tax revenue', now: before.revenue.nonTax, next: after.revenue.nonTax },
    { label: 'Total revenue', now: before.totalRevenue, next: after.totalRevenue },
    {
      label: 'Ministries',
      now: MINISTRIES.reduce((s, m) => s + before.expenditure[m], 0),
      next: MINISTRIES.reduce((s, m) => s + after.expenditure[m], 0),
    },
    { label: 'Pensions & salaries', now: before.expenditure.establishment, next: after.expenditure.establishment },
    { label: 'Interest on debt', now: before.expenditure.interest, next: after.expenditure.interest },
    { label: 'Total spending', now: before.totalExpenditure, next: after.totalExpenditure },
    { label: 'Monthly balance', now: before.balance, next: after.balance, tone: true },
  ];

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Budget</h1>
          <p className={gameStyles.viewSubtitle}>
            One budget a month. Taxes move at most {Math.round(MAX_TAX_STEP * 100)} points per budget.
          </p>
        </div>
      </div>

      <div className={gameStyles.grid}>
        <Panel title="Taxes" className={gameStyles.span8}>
          <div className={styles.sliders}>
            {TAXES.map((t) => {
              const min = round(Math.max(TAX_LIMITS[t].min, current.taxRates[t] - MAX_TAX_STEP), 0.005);
              const max = round(Math.min(TAX_LIMITS[t].max, current.taxRates[t] + MAX_TAX_STEP), 0.005);
              const value = proposal.taxRates[t];
              const moved = Math.abs(value - current.taxRates[t]) > 1e-9;
              return (
                <label key={t} className={styles.slider}>
                  <span className={styles.sliderLabel}>{TAX_LABELS[t]}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.005}
                    value={value}
                    aria-label={TAX_LABELS[t]}
                    onChange={(e) => setTax(t, round(Number(e.target.value), 0.005))}
                  />
                  <span className={`${styles.sliderValue} ${moved ? styles.changed : ''}`}>
                    {pct(value)}
                    <span className={styles.sliderHint}>
                      legal {pct(TAX_LIMITS[t].min, 0)}–{pct(TAX_LIMITS[t].max, 0)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Panel>

        <Panel title="Projected month" className={gameStyles.span4}>
          <div className={styles.projection} data-testid="projection">
            <span className={styles.projectionHead}>Item</span>
            <span className={styles.projectionHead}>Now</span>
            <span className={styles.projectionHead}>Proposed</span>
            {rows.map((r) => (
              <span key={r.label} style={{ display: 'contents' }}>
                <span>{r.label}</span>
                <span className={styles.num}>{formatCrore(r.now)}</span>
                <span
                  className={`${styles.num} ${r.tone ? (r.next >= 0 ? styles.positive : styles.negative) : ''}`}
                  data-testid={r.tone ? 'projected-balance' : undefined}
                >
                  {formatCrore(r.next)}
                </span>
              </span>
            ))}
            <span>Deficit (% of GDP)</span>
            <span className={styles.num}>{pct(-before.balanceToGdp)}</span>
            <span className={styles.num}>{pct(-after.balanceToGdp)}</span>
          </div>
          <p className={styles.note}>
            Approval: {signed(shortTerm)} now from the announcement, {signed(longTerm)} in the long run.
          </p>
        </Panel>

        <Panel title="Ministry funding (% of the standard allocation)" className={gameStyles.span8}>
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
                    aria-label={`${MINISTRY_CONTENT[m].shortName} funding`}
                    onChange={(e) => setAllocation(m, round(Number(e.target.value), 0.05))}
                  />
                  <span className={`${styles.sliderValue} ${moved ? styles.changed : ''}`}>
                    {Math.round(multiple * 100)}%
                    <span className={styles.sliderHint}>{formatCrore(proposal.allocations[m] * gdp)}/yr</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Panel>

        <Panel title="Spending per year" className={gameStyles.span4}>
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
          {nextDate && <span className={styles.note}>Next budget can be enacted on {formatDate(nextDate)}.</span>}
          <Button disabled={!changed} onClick={() => setDraft(null)}>
            Reset
          </Button>
          <Button variant="primary" disabled={!changed || nextDate !== null} onClick={enact}>
            Enact budget
          </Button>
        </div>
      </div>
    </>
  );
}

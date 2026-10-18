import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dailyFinance,
  departmentFunding,
  INTL_LENDER,
  lenderCap,
  lenderName,
  lenderProblem,
  LENDERS,
  loanCeiling,
  loanRate,
  marketRate,
  MAX_LOAN_YEARS,
  MINISTRIES,
  MINISTRY_CONTENT,
  MIN_LOAN,
  outstanding,
  RECEIPT_SOURCES,
  REVENUE_LINES,
  totalReceipts,
  UNDERFUNDED_BELOW,
  validateLoan,
  validateRepay,
  type GameState,
  type LoanLender,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Panel, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreDelta, pct } from '../format';
import { t as translate } from '../i18n';
import gameStyles from '../screens/game.module.css';
import { daysLeft } from './military/progress';
import styles from './views.module.css';

const lenderLabel = (lender: LoanLender): string =>
  lender === INTL_LENDER ? translate('finance.intl') : lenderName(lender);

function Tiles({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const daily = dailyFinance(game);
  return (
    <div className={styles.tiles} style={{ marginBottom: 16 }}>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('finance.tiles.treasury')}</span>
        <span className={styles.tileValue}>{formatCrore(game.nation.treasury)}</span>
        <span className={styles.tileNote}>{t('finance.tiles.treasuryNote')}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('finance.tiles.perDay')}</span>
        <span
          className={`${styles.tileValue} ${daily.balance >= 0 ? styles.positive : styles.negative}`}
          data-testid="daily-balance"
        >
          {formatCroreDelta(daily.balance)}
        </span>
        <span className={styles.tileNote}>{t('finance.tiles.perDayNote', { days: daily.days })}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('finance.tiles.loans')}</span>
        <span className={styles.tileValue} data-testid="loans-outstanding">
          {formatCrore(outstanding(game))}
        </span>
        <span className={styles.tileNote}>
          {t('finance.tiles.loansNote', { ceiling: formatCrore(loanCeiling(game)) })}
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.tileLabel}>{t('finance.tiles.market')}</span>
        <span className={styles.tileValue}>{pct(marketRate(game))}</span>
        <span className={styles.tileNote}>
          {t('finance.tiles.marketNote', { average: pct(game.economy.interestRate) })}
        </span>
      </div>
    </div>
  );
}

function GeneralExpenses({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { setView } = gameStore.getState();
  const daily = dailyFinance(game);
  return (
    <Panel title={t('finance.expenses')} className={gameStyles.span6}>
      <p className={styles.note}>{t('finance.expensesNote')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="general-expenses">
          <thead>
            <tr>
              <th>{t('finance.columns.line')}</th>
              <th className={styles.num}>{t('finance.columns.perDay')}</th>
              <th className={styles.num}>{t('finance.columns.perMonth')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {MINISTRIES.map((m) => {
              const underfunded = departmentFunding(game, m) < UNDERFUNDED_BELOW;
              return (
                <tr key={m}>
                  <td>{MINISTRY_CONTENT[m].shortName}</td>
                  <td className={styles.num}>{formatCrore(daily.expenditure[m])}</td>
                  <td className={styles.num}>{formatCrore(daily.expenditure[m] * daily.days)}</td>
                  <td>
                    {underfunded && (
                      <button type="button" className={styles.tag} onClick={() => setView('budget')}>
                        {t('finance.underfunded')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(['establishment', 'interest'] as const).map((line) => (
              <tr key={line}>
                <td>{t(`finance.lines.${line}`)}</td>
                <td className={styles.num}>{formatCrore(daily.expenditure[line])}</td>
                <td className={styles.num}>{formatCrore(daily.expenditure[line] * daily.days)}</td>
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('finance.totalSpending')}</td>
              <td className={styles.num}>{formatCrore(daily.totalExpenditure)}</td>
              <td className={styles.num}>{formatCrore(daily.totalExpenditure * daily.days)}</td>
              <td />
            </tr>
            {REVENUE_LINES.map((line) => (
              <tr key={line}>
                <td>{t(`economy.revenueLines.${line}`)}</td>
                <td className={styles.num}>{formatCrore(daily.revenue[line])}</td>
                <td className={styles.num}>{formatCrore(daily.revenue[line] * daily.days)}</td>
                <td />
              </tr>
            ))}
            <tr>
              <td>{t('finance.balance')}</td>
              <td className={`${styles.num} ${daily.balance >= 0 ? styles.positive : styles.negative}`}>
                {formatCroreDelta(daily.balance)}
              </td>
              <td className={`${styles.num} ${daily.balance >= 0 ? styles.positive : styles.negative}`}>
                {formatCroreDelta(daily.balance * daily.days)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

/** Money that reached the treasury outside the monthly settlement: this month so far, and last month. */
function Receipts({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const now = game.economy.receipts;
  const last = game.economy.lastMonth?.receipts ?? null;
  return (
    <Panel title={t('finance.receipts.title')} className={gameStyles.span6}>
      <p className={styles.note}>{t('finance.receipts.note')}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="one-off-receipts">
          <thead>
            <tr>
              <th>{t('finance.columns.line')}</th>
              <th className={styles.num}>{t('finance.columns.perMonth')}</th>
              <th className={styles.num}>{t('finance.receipts.lastMonth')}</th>
            </tr>
          </thead>
          <tbody>
            {RECEIPT_SOURCES.map((source) => (
              <tr key={source}>
                <td>{t(`finance.receipts.sources.${source}`)}</td>
                <td className={styles.num}>{formatCrore(now[source])}</td>
                <td className={styles.num}>{last ? formatCrore(last[source]) : '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('finance.receipts.total')}</td>
              <td className={styles.num}>{formatCrore(totalReceipts(now))}</td>
              <td className={styles.num}>{last ? formatCrore(totalReceipts(last)) : '–'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function Loans({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { dispatch } = gameStore.getState();
  const [lender, setLender] = useState<LoanLender>(INTL_LENDER);
  const [amount, setAmount] = useState(25_000);
  const [years, setYears] = useState(3);
  const rate = loanRate(game, lender, years);
  const problem = validateLoan(game, lender, amount, years);
  const lenders: LoanLender[] = [INTL_LENDER, ...LENDERS];
  return (
    <Panel title={t('finance.loans')} className={gameStyles.span6}>
      <p className={styles.note}>{t('finance.loansNote')}</p>
      <div className={styles.orderBar}>
        <select
          className={styles.select}
          aria-label={t('finance.lender')}
          value={lender}
          onChange={(e) => setLender(e.target.value as LoanLender)}
        >
          {lenders.map((l) => (
            <option key={l} value={l}>
              {lenderLabel(l)}
              {lenderProblem(game, l) ? ` · ${t('finance.unavailable')}` : ''}
            </option>
          ))}
        </select>
        <input
          type="number"
          className={styles.qtyInput}
          style={{ width: '9em' }}
          min={MIN_LOAN}
          step={1_000}
          value={amount}
          aria-label={t('finance.amount')}
          onChange={(e) => setAmount(Math.max(MIN_LOAN, Math.round(Number(e.target.value) || MIN_LOAN)))}
        />
        <select
          className={styles.select}
          aria-label={t('finance.years')}
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
        >
          {Array.from({ length: MAX_LOAN_YEARS }, (_, i) => i + 1).map((y) => (
            <option key={y} value={y}>
              {t('finance.yearsOption', { count: y })}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.note} data-testid="loan-terms">
        {t('finance.terms', {
          rate: pct(rate.total, 2),
          interest: formatCrore((amount * rate.total) / 12),
          cap: formatCrore(lenderCap(lender)),
        })}{' '}
        <Tooltip label={t('common.why')}>
          <span className={gameStyles.breakdown}>
            {rate.lines.map((l) => (
              <Fragment key={l.label}>
                <span>{l.label}</span>
                <span className={gameStyles.breakdownValue}>{pct(l.value, 2)}</span>
              </Fragment>
            ))}
          </span>
        </Tooltip>
      </p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={problem !== null}
          title={problem ?? undefined}
          aria-label={t('finance.borrowLabel', { amount: formatCrore(amount), lender: lenderLabel(lender) })}
          onClick={() => dispatch({ type: 'TAKE_LOAN', lender, amount, years })}
        >
          {t('finance.borrow', { amount: formatCrore(amount) })}
        </Button>
      </div>
      {problem && <p className={styles.note}>{problem}</p>}

      <h3 className={styles.areaHead}>{t('finance.owed')}</h3>
      {game.economy.loans.length === 0 ? (
        <p className={styles.note}>{t('finance.noLoans')}</p>
      ) : (
        <ul className={styles.riskList} aria-label={t('finance.owed')}>
          {game.economy.loans.map((loan) => {
            const repayProblem = validateRepay(game, loan.id);
            const name = lenderLabel(loan.lender);
            return (
              <li key={loan.id} className={styles.reportCard} data-testid="loan">
                <div className={styles.personName}>
                  {t('finance.loanLine', {
                    lender: name,
                    principal: formatCrore(loan.principal),
                    rate: pct(loan.rate, 2),
                  })}
                </div>
                <div className={styles.cardActions}>
                  <span className={styles.muted}>
                    {t('finance.dueIn', { count: daysLeft(loan.dueTick, game.clock.tick) })}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={repayProblem !== null}
                    title={repayProblem ?? undefined}
                    aria-label={t('finance.repayLabel', { lender: name, principal: formatCrore(loan.principal) })}
                    onClick={() => dispatch({ type: 'REPAY_LOAN', loanId: loan.id })}
                  >
                    {t('finance.repay')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function FinanceView() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.finance')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('finance.subtitle')}</p>
        </div>
      </div>
      <Tiles game={game} />
      <div className={gameStyles.grid}>
        <GeneralExpenses game={game} />
        <Loans game={game} />
        <Receipts game={game} />
      </div>
    </>
  );
}

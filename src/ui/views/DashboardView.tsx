import { Fragment } from 'react';
import { formatDate, formatMonth, resolve, TERM_YEARS, type Resolution } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Gauge, Panel, Stat, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreDelta, formatPercent } from '../format';
import styles from '../screens/game.module.css';

const TERM_DAYS = Math.round(TERM_YEARS * 365.25);

function BreakdownRows({ heading, resolution }: { heading: string; resolution: Resolution }) {
  return (
    <>
      <span className={styles.breakdownHeading}>{heading}</span>
      <span>Base</span>
      <span className={styles.breakdownValue}>{formatCrore(resolution.base)}</span>
      {resolution.breakdown.map((line) => (
        <Fragment key={line.source + line.label + line.kind}>
          <span>{line.label}</span>
          <span className={styles.breakdownValue}>
            {line.kind === 'mult' ? formatPercent(line.value) : formatCroreDelta(line.value)}
          </span>
        </Fragment>
      ))}
      <span>Expected</span>
      <span className={styles.breakdownValue}>{formatCrore(resolution.total)}</span>
    </>
  );
}

export function DashboardView() {
  const game = useGame((s) => s.game);
  if (!game) return null;

  const { nation, modifiers, clock, meta, log, history } = game;
  const revenue = resolve(modifiers, 'economy.monthlyRevenue', nation.baseMonthlyRevenue);
  const expenditure = resolve(modifiers, 'economy.monthlyExpenditure', nation.baseMonthlyExpenditure);
  const lastMonth = history.at(-1);
  const unread = log.filter((e) => !e.read).length;
  const termProgress = Math.min(1, clock.tick / TERM_DAYS);
  const termYear = Math.min(TERM_YEARS, Math.floor(clock.tick / 365.25) + 1);
  const { dispatch } = gameStore.getState();

  return (
    <>
      <div className={styles.viewHeader}>
        <div>
          <h1 className={styles.viewTitle}>Dashboard</h1>
          <p className={styles.viewSubtitle}>President {meta.presidentName}</p>
        </div>
      </div>

      <div className={styles.grid}>
        <Panel
          title="Treasury"
          className={styles.span4}
          actions={
            <Tooltip label="Why?">
              <span className={styles.breakdown}>
                <BreakdownRows heading="Monthly revenue" resolution={revenue} />
                <BreakdownRows heading="Monthly expenditure" resolution={expenditure} />
              </span>
            </Tooltip>
          }
        >
          <Stat
            label="Cash balance"
            value={formatCrore(nation.treasury)}
            testId="dashboard-treasury"
            {...(lastMonth && {
              delta: `${formatCroreDelta(lastMonth.balance)} in ${formatMonth(lastMonth.month)}`,
              deltaTone: lastMonth.balance >= 0 ? 'positive' : 'negative',
            })}
          />
          {!lastMonth && <p className={styles.muted}>The first monthly settlement arrives on the 1st of next month.</p>}
        </Panel>

        <Panel title="Public approval" className={styles.span4}>
          <Gauge value={nation.approval} label="Approval of the President" />
        </Panel>

        <Panel title="Term" className={styles.span4}>
          <Stat label={`Year ${termYear} of ${TERM_YEARS}`} value={`${Math.round(termProgress * 100)}%`} />
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Term progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(termProgress * 100)}
          >
            <div className={styles.progressFill} style={{ width: `${termProgress * 100}%` }} />
          </div>
          <p className={styles.muted}>Took office {formatDate(meta.startDate)}</p>
        </Panel>

        <Panel
          title="Presidential inbox"
          className={styles.span12}
          actions={
            unread > 0 && (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={styles.unreadBadge} aria-label={`${unread} unread`}>
                  {unread}
                </span>
                <Button variant="ghost" onClick={() => dispatch({ type: 'MARK_ALL_LOG_READ' })}>
                  Mark all read
                </Button>
              </span>
            )
          }
        >
          <ul className={styles.inbox}>
            {[...log].reverse().map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={styles.inboxItem}
                  data-severity={entry.severity}
                  data-read={entry.read}
                  onClick={() => !entry.read && dispatch({ type: 'MARK_LOG_READ', id: entry.id })}
                >
                  <span className={styles.inboxTitle}>
                    <span>{entry.title}</span>
                    <span className={styles.inboxDate}>{formatDate(entry.date)}</span>
                  </span>
                  <span className={styles.muted}>{entry.body}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

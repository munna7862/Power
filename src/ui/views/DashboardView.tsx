import { Fragment } from 'react';
import {
  APPROVAL_FACTOR_LABELS,
  APPROVAL_FACTORS,
  APPROVAL_WEIGHTS,
  approvalTarget,
  debtToGdp,
  formatDate,
  formatMonth,
  TERM_YEARS,
  topIssues,
} from '../../sim';
import { gameStore, useGame } from '../../store';
import { LineChart } from '../charts/LineChart';
import { Button, Gauge, Panel, Stat, Tooltip } from '../design/primitives';
import { formatCrore, formatCroreDelta, pct, signed } from '../format';
import styles from '../screens/game.module.css';
import viewStyles from './views.module.css';

const TERM_DAYS = Math.round(TERM_YEARS * 365.25);

const satisfactionColour = (v: number) => (v >= 60 ? 'var(--green)' : v >= 40 ? 'var(--warning)' : 'var(--danger)');

export function DashboardView() {
  const game = useGame((s) => s.game);
  if (!game) return null;

  const { nation, economy, politics, clock, meta, log, history } = game;
  const target = approvalTarget(game, politics.satisfaction);
  const issues = topIssues(politics.satisfaction);
  const lastMonth = history.at(-1);
  const unread = log.filter((e) => !e.read).length;
  const termProgress = Math.min(1, clock.tick / TERM_DAYS);
  const termYear = Math.min(TERM_YEARS, Math.floor(clock.tick / 365.25) + 1);
  const { dispatch } = gameStore.getState();
  const recent = history.slice(-24);

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
          title="Public approval"
          className={styles.span4}
          actions={
            <Tooltip label="Why?">
              <span className={styles.breakdown}>
                <span className={styles.breakdownHeading}>Voters score (weight)</span>
                {APPROVAL_FACTORS.map((f) => (
                  <Fragment key={f}>
                    <span>
                      {APPROVAL_FACTOR_LABELS[f]} ({Math.round(APPROVAL_WEIGHTS[f] * 100)}%)
                    </span>
                    <span className={styles.breakdownValue}>{Math.round(politics.satisfaction[f])}</span>
                  </Fragment>
                ))}
                {target.breakdown.length > 0 && <span className={styles.breakdownHeading}>Adjustments</span>}
                {target.breakdown.map((line, i) => (
                  <Fragment key={`${line.source}-${i}`}>
                    <span>{line.label}</span>
                    <span className={styles.breakdownValue}>{signed(line.value)}</span>
                  </Fragment>
                ))}
                <span>Approval is heading to</span>
                <span className={styles.breakdownValue}>{target.total.toFixed(1)}%</span>
              </span>
            </Tooltip>
          }
        >
          <Gauge value={nation.approval} label="Approval of the President" />
        </Panel>

        <Panel title="Top issues" className={styles.span4}>
          <ul className={viewStyles.issues} aria-label="Top issues">
            {issues.map((f) => (
              <li key={f} className={viewStyles.issue}>
                <span>{APPROVAL_FACTOR_LABELS[f]}</span>
                <span className={viewStyles.muted}>{Math.round(politics.satisfaction[f])}/100</span>
                <span className={viewStyles.meter} aria-hidden="true">
                  <span
                    className={viewStyles.meterFill}
                    style={{
                      width: `${politics.satisfaction[f]}%`,
                      background: satisfactionColour(politics.satisfaction[f]),
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className={viewStyles.note}>The three things voters are least happy with.</p>
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

        <div className={`${styles.span12} ${viewStyles.tiles}`}>
          {[
            { label: 'Real growth', value: pct(economy.realGrowth) },
            { label: 'Inflation', value: pct(economy.inflation) },
            { label: 'Unemployment', value: pct(economy.unemployment) },
            { label: 'Debt (% of GDP)', value: pct(debtToGdp(economy), 0) },
          ].map((t) => (
            <div key={t.label} className={viewStyles.tile}>
              <span className={viewStyles.tileLabel}>{t.label}</span>
              <span className={viewStyles.tileValue}>{t.value}</span>
            </div>
          ))}
        </div>

        <Panel title="Treasury" className={styles.span4}>
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
          {lastMonth && (
            <p className={styles.muted}>
              {lastMonth.balance < 0
                ? 'Deficits are covered by borrowing.'
                : 'Surplus cash above the reserve repays debt.'}
            </p>
          )}
        </Panel>

        <Panel title="Trends (last 2 years)" className={styles.span8}>
          <div className={viewStyles.charts}>
            <LineChart
              title="Real GDP growth"
              data={recent.map((h) => ({ label: formatMonth(h.month), value: h.realGrowth }))}
              format={(v) => pct(v)}
              height={110}
            />
            <LineChart
              title="Monthly budget balance"
              data={recent.map((h) => ({ label: formatMonth(h.month), value: h.balance }))}
              format={formatCrore}
              height={110}
            />
          </div>
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

import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  APPROVAL_FACTORS,
  APPROVAL_WEIGHTS,
  approvalTarget,
  debtToGdp,
  electionYear,
  formatDate,
  formatMonth,
  reelectionApproval,
  TERM_YEARS,
  topIssues,
  voterFatigue,
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
  const { t } = useTranslation();
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
  const needed = reelectionApproval(game);
  const fatigue = voterFatigue(game);
  const tiles = [
    { id: 'growth', value: pct(economy.realGrowth) },
    { id: 'inflation', value: pct(economy.inflation) },
    { id: 'unemployment', value: pct(economy.unemployment) },
    { id: 'debt', value: pct(debtToGdp(economy), 0) },
  ] as const;

  return (
    <>
      <div className={styles.viewHeader}>
        <div>
          <h1 className={styles.viewTitle}>{t('nav.views.dashboard')}</h1>
          <p className={styles.viewSubtitle}>{t('dashboard.subtitle', { name: meta.presidentName })}</p>
        </div>
      </div>

      <div className={styles.grid}>
        <Panel
          title={t('dashboard.approval')}
          className={styles.span4}
          actions={
            <Tooltip label={t('common.why')}>
              <span className={styles.breakdown}>
                <span className={styles.breakdownHeading}>{t('dashboard.votersScore')}</span>
                {APPROVAL_FACTORS.map((f) => (
                  <Fragment key={f}>
                    <span>
                      {t('dashboard.factorWeight', {
                        factor: t(`dashboard.factors.${f}`),
                        weight: Math.round(APPROVAL_WEIGHTS[f] * 100),
                      })}
                    </span>
                    <span className={styles.breakdownValue}>{Math.round(politics.satisfaction[f])}</span>
                  </Fragment>
                ))}
                {target.breakdown.length > 0 && (
                  <span className={styles.breakdownHeading}>{t('dashboard.adjustments')}</span>
                )}
                {target.breakdown.map((line, i) => (
                  <Fragment key={`${line.source}-${i}`}>
                    <span>{line.label}</span>
                    <span className={styles.breakdownValue}>{signed(line.value)}</span>
                  </Fragment>
                ))}
                <span>{t('dashboard.heading')}</span>
                <span className={styles.breakdownValue}>{target.total.toFixed(1)}%</span>
              </span>
            </Tooltip>
          }
        >
          <Gauge value={nation.approval} label={t('dashboard.approvalGauge')} />
        </Panel>

        <Panel title={t('dashboard.topIssues')} className={styles.span4}>
          <ul className={viewStyles.issues} aria-label={t('dashboard.topIssues')}>
            {issues.map((f) => (
              <li key={f} className={viewStyles.issue}>
                <span>{t(`dashboard.factors.${f}`)}</span>
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
          <p className={viewStyles.note}>{t('dashboard.topIssuesNote')}</p>
        </Panel>

        <Panel title={t('dashboard.term')} className={styles.span4}>
          {meta.endless ? (
            <Stat label={t('dashboard.endless')} value={t('dashboard.secondTerm')} />
          ) : (
            <>
              <Stat
                label={t('dashboard.year', { year: termYear, total: TERM_YEARS })}
                value={`${Math.round(termProgress * 100)}%`}
              />
              <div
                className={styles.progress}
                role="progressbar"
                aria-label={t('dashboard.termProgress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(termProgress * 100)}
              >
                <div className={styles.progressFill} style={{ width: `${termProgress * 100}%` }} />
              </div>
            </>
          )}
          <p className={styles.muted} data-testid="election-note">
            {meta.endless
              ? t('dashboard.endlessNote')
              : t('dashboard.election', { year: electionYear(game), approval: needed })}
          </p>
          {fatigue < 0 && <p className={styles.muted}>{t('dashboard.fatigue', { points: -fatigue })}</p>}
          <p className={styles.muted}>{t('dashboard.tookOffice', { date: formatDate(meta.startDate) })}</p>
        </Panel>

        <div className={`${styles.span12} ${viewStyles.tiles}`}>
          {tiles.map((tile) => (
            <div key={tile.id} className={viewStyles.tile}>
              <span className={viewStyles.tileLabel}>{t(`gameOver.stats.${tile.id}`)}</span>
              <span className={viewStyles.tileValue}>{tile.value}</span>
            </div>
          ))}
        </div>

        <Panel title={t('topbar.treasury')} className={styles.span4}>
          <Stat
            label={t('dashboard.cash')}
            value={formatCrore(nation.treasury)}
            testId="dashboard-treasury"
            {...(lastMonth && {
              delta: t('dashboard.monthDelta', {
                delta: formatCroreDelta(lastMonth.balance),
                month: formatMonth(lastMonth.month),
              }),
              deltaTone: lastMonth.balance >= 0 ? 'positive' : 'negative',
            })}
          />
          {!lastMonth && <p className={styles.muted}>{t('dashboard.firstSettlement')}</p>}
          {lastMonth && (
            <p className={styles.muted}>{lastMonth.balance < 0 ? t('dashboard.deficit') : t('dashboard.surplus')}</p>
          )}
        </Panel>

        <Panel title={t('dashboard.trends')} className={styles.span8}>
          <div className={viewStyles.charts}>
            <LineChart
              title={t('dashboard.growthChart')}
              data={recent.map((h) => ({ label: formatMonth(h.month), value: h.realGrowth }))}
              format={(v) => pct(v)}
              height={110}
            />
            <LineChart
              title={t('dashboard.balanceChart')}
              data={recent.map((h) => ({ label: formatMonth(h.month), value: h.balance }))}
              format={formatCrore}
              height={110}
            />
          </div>
        </Panel>

        <Panel
          title={t('dashboard.inbox')}
          className={styles.span12}
          actions={
            unread > 0 && (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={styles.unreadBadge} aria-label={t('dashboard.unread', { count: unread })}>
                  {unread}
                </span>
                <Button variant="ghost" onClick={() => dispatch({ type: 'MARK_ALL_LOG_READ' })}>
                  {t('inbox.markAll')}
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

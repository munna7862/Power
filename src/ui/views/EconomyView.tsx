import { useState } from 'react';
import {
  debtToGdp,
  explainGrowth,
  formatMonth,
  GROWTH_DRIVER_LABELS,
  MINISTRIES,
  MINISTRY_CONTENT,
  nominalGdp,
  REVENUE_LINES,
  SECTORS,
  sectorShare,
  type MonthlySnapshot,
} from '../../sim';
import { useGame } from '../../store';
import { LineChart } from '../charts/LineChart';
import { Panel, Tooltip } from '../design/primitives';
import { formatCrore, pct, pts } from '../format';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

const RANGES = { '1Y': 12, '5Y': 60, All: Infinity } as const;
type Range = keyof typeof RANGES;

const SECTOR_LABELS = {
  agriculture: 'Agriculture',
  industry: 'Industry',
  services: 'Services',
  energy: 'Energy',
  tech: 'Tech',
};
const REVENUE_LABELS = {
  income: 'Income tax',
  corporate: 'Corporate tax',
  gst: 'GST',
  customs: 'Customs',
  nonTax: 'Non-tax revenue',
};

const CHARTS: { title: string; pick: (h: MonthlySnapshot) => number; format: (v: number) => string; zero?: boolean }[] =
  [
    { title: 'Real GDP growth', pick: (h) => h.realGrowth, format: (v) => pct(v) },
    { title: 'Inflation', pick: (h) => h.inflation, format: (v) => pct(v) },
    { title: 'Unemployment', pick: (h) => h.unemployment, format: (v) => pct(v) },
    { title: 'Public debt (% of GDP)', pick: (h) => h.debtToGdp, format: (v) => pct(v, 0), zero: true },
    { title: 'Corruption index', pick: (h) => h.corruption, format: (v) => v.toFixed(0), zero: true },
    { title: 'Human Development Index', pick: (h) => h.hdi, format: (v) => v.toFixed(3) },
  ];

export function EconomyView() {
  const game = useGame((s) => s.game);
  const [range, setRange] = useState<Range>('5Y');
  if (!game) return null;

  const { economy, history } = game;
  const gdp = nominalGdp(economy);
  const perCapita = (gdp * 1e7) / game.nation.population;
  const growth = explainGrowth(game);
  const expected = growth.reduce((s, g) => s + g.value, 0);
  const shown = history.slice(-Math.min(RANGES[range], history.length));
  const last = economy.lastMonth;

  const tiles = [
    {
      label: 'GDP (annual)',
      value: formatCrore(gdp),
      note: `₹${Math.round(perCapita).toLocaleString('en-IN')} per person`,
    },
    { label: 'Real growth', value: pct(economy.realGrowth), note: `Trend ${pct(expected)}` },
    { label: 'Inflation', value: pct(economy.inflation), note: 'Target band 2–6%' },
    { label: 'Unemployment', value: pct(economy.unemployment), note: 'Share of workforce' },
    {
      label: 'Public debt',
      value: pct(debtToGdp(economy), 0),
      note: `${formatCrore(economy.debt)} at ${pct(economy.interestRate)}`,
    },
    { label: 'Treasury cash', value: formatCrore(game.nation.treasury), note: 'Reserve of half a month' },
    { label: 'HDI', value: economy.hdi.toFixed(3), note: 'Human Development Index' },
    { label: 'Corruption', value: economy.corruption.toFixed(0), note: '0 clean – 100 rotten' },
  ];

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Economy</h1>
          <p className={gameStyles.viewSubtitle}>Settles on the 1st of every month</p>
        </div>
        <Tooltip label="Why this growth?">
          <span className={gameStyles.breakdown}>
            <span className={gameStyles.breakdownHeading}>Expected real growth</span>
            {growth.map((g) => (
              <span key={g.driver} style={{ display: 'contents' }}>
                <span>{GROWTH_DRIVER_LABELS[g.driver]}</span>
                <span className={gameStyles.breakdownValue}>{g.driver === 'trend' ? pct(g.value) : pts(g.value)}</span>
              </span>
            ))}
            <span>Expected</span>
            <span className={gameStyles.breakdownValue}>{pct(expected)}</span>
          </span>
        </Tooltip>
      </div>

      <div className={gameStyles.grid}>
        <div className={`${gameStyles.span12} ${styles.tiles}`}>
          {tiles.map((t) => (
            <div key={t.label} className={styles.tile}>
              <span className={styles.tileLabel}>{t.label}</span>
              <span className={styles.tileValue} data-testid={`tile-${t.label}`}>
                {t.value}
              </span>
              <span className={styles.tileNote}>{t.note}</span>
            </div>
          ))}
        </div>

        <Panel
          title="Indicators"
          className={gameStyles.span12}
          actions={
            <div className={styles.segmented} role="group" aria-label="Time range">
              {(Object.keys(RANGES) as Range[]).map((r) => (
                <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          }
        >
          <div className={styles.charts}>
            {CHARTS.map((c) => (
              <LineChart
                key={c.title}
                title={c.title}
                data={shown.map((h) => ({ label: formatMonth(h.month), value: c.pick(h) }))}
                format={c.format}
                {...(c.zero && { zeroBased: true })}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Sectors" className={gameStyles.span4}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Sector</th>
                  <th>Share</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                {SECTORS.map((s) => (
                  <tr key={s}>
                    <td>{SECTOR_LABELS[s]}</td>
                    <td>{pct(sectorShare(economy, s))}</td>
                    <td className={economy.sectors[s].growth >= 0 ? styles.positive : styles.negative}>
                      {pct(economy.sectors[s].growth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={last ? `Last month's accounts` : 'Accounts'} className={gameStyles.span8}>
          {!last ? (
            <p className={styles.muted}>The first monthly settlement arrives on the 1st of next month.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Revenue</th>
                    <th>₹ crore</th>
                    <th>Spending</th>
                    <th>₹ crore</th>
                  </tr>
                </thead>
                <tbody>
                  {[...MINISTRIES, 'establishment', 'interest'].map((line, i) => {
                    const revenueLine = REVENUE_LINES[i];
                    return (
                      <tr key={line}>
                        <td>{revenueLine ? REVENUE_LABELS[revenueLine] : ''}</td>
                        <td>{revenueLine ? formatCrore(last.revenue[revenueLine]) : ''}</td>
                        <td style={{ textAlign: 'left' }}>
                          {line === 'establishment'
                            ? 'Pensions & salaries'
                            : line === 'interest'
                              ? 'Interest on debt'
                              : MINISTRY_CONTENT[line as (typeof MINISTRIES)[number]].shortName}
                        </td>
                        <td>{formatCrore(last.expenditure[line as keyof typeof last.expenditure])}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{formatCrore(last.totalRevenue)}</td>
                    <td style={{ textAlign: 'left' }}>Balance</td>
                    <td className={last.balance >= 0 ? styles.positive : styles.negative}>
                      {formatCrore(last.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

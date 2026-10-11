import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  debtToGdp,
  explainGrowth,
  formatMonth,
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

const RANGES = { '1Y': 12, '5Y': 60, all: Infinity } as const;
type Range = keyof typeof RANGES;

const CHARTS: {
  id: 'growth' | 'inflation' | 'unemployment' | 'debt' | 'corruption' | 'hdi';
  pick: (h: MonthlySnapshot) => number;
  format: (v: number) => string;
  zero?: boolean;
}[] = [
  { id: 'growth', pick: (h) => h.realGrowth, format: (v) => pct(v) },
  { id: 'inflation', pick: (h) => h.inflation, format: (v) => pct(v) },
  { id: 'unemployment', pick: (h) => h.unemployment, format: (v) => pct(v) },
  { id: 'debt', pick: (h) => h.debtToGdp, format: (v) => pct(v, 0), zero: true },
  { id: 'corruption', pick: (h) => h.corruption, format: (v) => v.toFixed(0), zero: true },
  { id: 'hdi', pick: (h) => h.hdi, format: (v) => v.toFixed(3) },
];

export function EconomyView() {
  const { t } = useTranslation();
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
      id: 'gdp',
      value: formatCrore(gdp),
      sub: t('economy.tiles.gdpNote', { value: Math.round(perCapita).toLocaleString('en-IN') }),
    },
    { id: 'growth', value: pct(economy.realGrowth), sub: t('economy.tiles.growthNote', { trend: pct(expected) }) },
    { id: 'inflation', value: pct(economy.inflation), sub: t('economy.tiles.inflationNote') },
    { id: 'unemployment', value: pct(economy.unemployment), sub: t('economy.tiles.unemploymentNote') },
    {
      id: 'debt',
      value: pct(debtToGdp(economy), 0),
      sub: t('economy.tiles.debtNote', { debt: formatCrore(economy.debt), rate: pct(economy.interestRate) }),
    },
    { id: 'treasury', value: formatCrore(game.nation.treasury), sub: t('economy.tiles.treasuryNote') },
    { id: 'hdi', value: economy.hdi.toFixed(3), sub: t('economy.tiles.hdiNote') },
    { id: 'corruption', value: economy.corruption.toFixed(0), sub: t('economy.tiles.corruptionNote') },
  ] as const;

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>{t('nav.views.economy')}</h1>
          <p className={gameStyles.viewSubtitle}>{t('economy.subtitle')}</p>
        </div>
        <Tooltip label={t('economy.whyGrowth')}>
          <span className={gameStyles.breakdown}>
            <span className={gameStyles.breakdownHeading}>{t('economy.expectedGrowth')}</span>
            {growth.map((g) => (
              <span key={g.driver} style={{ display: 'contents' }}>
                <span>{t(`economy.drivers.${g.driver}`)}</span>
                <span className={gameStyles.breakdownValue}>{g.driver === 'trend' ? pct(g.value) : pts(g.value)}</span>
              </span>
            ))}
            <span>{t('economy.expected')}</span>
            <span className={gameStyles.breakdownValue}>{pct(expected)}</span>
          </span>
        </Tooltip>
      </div>

      <div className={gameStyles.grid}>
        <div className={`${gameStyles.span12} ${styles.tiles}`}>
          {tiles.map((tile) => (
            <div key={tile.id} className={styles.tile}>
              <span className={styles.tileLabel}>{t(`economy.tiles.${tile.id}`)}</span>
              <span className={styles.tileValue} data-testid={`tile-${tile.id}`}>
                {tile.value}
              </span>
              <span className={styles.tileNote}>{tile.sub}</span>
            </div>
          ))}
        </div>

        <Panel
          title={t('economy.indicators')}
          className={gameStyles.span12}
          actions={
            <div className={styles.segmented} role="group" aria-label={t('economy.range')}>
              {(Object.keys(RANGES) as Range[]).map((r) => (
                <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                  {t(`economy.ranges.${r}`)}
                </button>
              ))}
            </div>
          }
        >
          <div className={styles.charts}>
            {CHARTS.map((c) => (
              <LineChart
                key={c.id}
                title={t(`economy.charts.${c.id}`)}
                data={shown.map((h) => ({ label: formatMonth(h.month), value: c.pick(h) }))}
                format={c.format}
                {...(c.zero && { zeroBased: true })}
              />
            ))}
          </div>
        </Panel>

        <Panel title={t('economy.sectors')} className={gameStyles.span4}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('economy.sector')}</th>
                  <th>{t('economy.share')}</th>
                  <th>{t('economy.growth')}</th>
                </tr>
              </thead>
              <tbody>
                {SECTORS.map((s) => (
                  <tr key={s}>
                    <td>{t(`economy.sectorNames.${s}`)}</td>
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

        <Panel title={last ? t('economy.lastAccounts') : t('economy.accounts')} className={gameStyles.span8}>
          {!last ? (
            <p className={styles.muted}>{t('dashboard.firstSettlement')}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('economy.revenue')}</th>
                    <th>{t('economy.crore')}</th>
                    <th>{t('economy.spending')}</th>
                    <th>{t('economy.crore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...MINISTRIES, 'establishment', 'interest'].map((line, i) => {
                    const revenueLine = REVENUE_LINES[i];
                    return (
                      <tr key={line}>
                        <td>{revenueLine ? t(`economy.revenueLines.${revenueLine}`) : ''}</td>
                        <td>{revenueLine ? formatCrore(last.revenue[revenueLine]) : ''}</td>
                        <td style={{ textAlign: 'left' }}>
                          {line === 'establishment'
                            ? t('economy.establishment')
                            : line === 'interest'
                              ? t('economy.interest')
                              : MINISTRY_CONTENT[line as (typeof MINISTRIES)[number]].shortName}
                        </td>
                        <td>{formatCrore(last.expenditure[line as keyof typeof last.expenditure])}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('economy.total')}</td>
                    <td>{formatCrore(last.totalRevenue)}</td>
                    <td style={{ textAlign: 'left' }}>{t('economy.balance')}</td>
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

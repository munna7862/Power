import { formatMonth, type MonthlySnapshot } from '../../sim';
import { useGame } from '../../store';
import { LineChart } from '../charts/LineChart';
import { Panel } from '../design/primitives';
import { formatCrore, pct } from '../format';
import gameStyles from '../screens/game.module.css';
import styles from './views.module.css';

interface YearRow {
  year: number;
  months: number;
  growth: number;
  inflation: number;
  unemployment: number;
  balance: number;
  balanceToGdp: number;
  debtToGdp: number;
  approval: number;
}

function byYear(history: readonly MonthlySnapshot[]): YearRow[] {
  const groups = new Map<number, MonthlySnapshot[]>();
  for (const h of history) groups.set(h.month.year, [...(groups.get(h.month.year) ?? []), h]);
  return [...groups.entries()].map(([year, months]) => {
    const last = months.at(-1) as MonthlySnapshot;
    const balance = months.reduce((s, m) => s + m.balance, 0);
    const gdp = months.reduce((s, m) => s + m.gdp, 0) / months.length;
    return {
      year,
      months: months.length,
      growth: months.reduce((s, m) => s + m.realGrowth, 0) / months.length,
      inflation: last.inflation,
      unemployment: last.unemployment,
      balance,
      balanceToGdp: (balance * (12 / months.length)) / gdp,
      debtToGdp: last.debtToGdp,
      approval: last.approval,
    };
  });
}

export function ReportsView() {
  const history = useGame((s) => s.game?.history ?? []);
  const rows = byYear(history).reverse();

  return (
    <>
      <div className={gameStyles.viewHeader}>
        <div>
          <h1 className={gameStyles.viewTitle}>Reports</h1>
          <p className={gameStyles.viewSubtitle}>Your record in office, year by year</p>
        </div>
      </div>
      <div className={gameStyles.grid}>
        <Panel title="Annual record" className={gameStyles.span12}>
          {rows.length === 0 ? (
            <p className={styles.muted}>The first figures arrive on the 1st of next month.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Real growth</th>
                    <th>Inflation</th>
                    <th>Unemployment</th>
                    <th>Budget balance</th>
                    <th>Balance % GDP</th>
                    <th>Debt % GDP</th>
                    <th>Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year}>
                      <td>
                        {r.year}
                        {r.months < 12 && <span className={styles.muted}> ({r.months} mo)</span>}
                      </td>
                      <td>{pct(r.growth)}</td>
                      <td>{pct(r.inflation)}</td>
                      <td>{pct(r.unemployment)}</td>
                      <td className={r.balance >= 0 ? styles.positive : styles.negative}>{formatCrore(r.balance)}</td>
                      <td>{pct(r.balanceToGdp)}</td>
                      <td>{pct(r.debtToGdp, 0)}</td>
                      <td>{r.approval.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Approval history" className={gameStyles.span12}>
          <LineChart
            title="Approval of the President"
            data={history.map((h) => ({ label: formatMonth(h.month), value: h.approval }))}
            format={(v) => `${v.toFixed(0)}%`}
            height={180}
          />
        </Panel>
      </div>
    </>
  );
}

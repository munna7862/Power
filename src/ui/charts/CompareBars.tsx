import { useTranslation } from 'react-i18next';
import styles from './charts.module.css';

export interface CompareRow {
  label: string;
  current: number;
  proposed: number;
}

/**
 * Two-series horizontal bars (current vs proposed) sharing one scale. Values are
 * directly labelled, so the legend plus labels keep identity off colour alone.
 */
export function CompareBars({ rows, format }: { rows: readonly CompareRow[]; format: (v: number) => string }) {
  const { t } = useTranslation();
  const max = Math.max(...rows.flatMap((r) => [r.current, r.proposed]), 1);
  return (
    <div className={styles.chart}>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <span className={styles.legendKey} style={{ background: 'var(--series-1)' }} />
          {t('charts.current')}
        </span>
        <span>
          <span className={styles.legendKey} style={{ background: 'var(--series-2)' }} />
          {t('charts.proposed')}
        </span>
      </div>
      <div className={styles.barRows} role="table" aria-label={t('charts.compareLabel')}>
        {rows.map((r) => (
          <div key={r.label} className={styles.barRow} role="row">
            <span className={styles.barLabel} role="rowheader">
              {r.label}
            </span>
            <span
              className={styles.barTrack}
              role="cell"
              aria-label={t('charts.currentValue', { value: format(r.current) })}
            >
              <span
                className={styles.bar}
                style={{ width: `${(r.current / max) * 100}%`, background: 'var(--series-1)' }}
              />
              <span
                className={styles.bar}
                style={{ width: `${(r.proposed / max) * 100}%`, background: 'var(--series-2)' }}
              />
            </span>
            <span className={styles.barValue} role="cell">
              {format(r.proposed)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

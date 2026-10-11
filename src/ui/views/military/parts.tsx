import type { ReactNode } from 'react';
import styles from '../views.module.css';

export type BarTone = 'good' | 'warning' | 'danger' | 'accent';

/** Horizontal progress/score bar with an accessible value. */
export function Bar({ value, max = 100, label, tone }: { value: number; max?: number; label: string; tone?: BarTone }) {
  const share = Math.max(0, Math.min(1, value / max));
  const auto: BarTone = share >= 0.5 ? 'good' : share >= 0.3 ? 'warning' : 'danger';
  const shown = tone ?? auto;
  return (
    <span
      className={styles.bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <span
        className={styles.barFill}
        data-tone={shown === 'good' ? undefined : shown}
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}

/** A −100…+100 bar that fills from the middle: green to the right (India advancing), red to the left. */
export function CentreBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const width = Math.abs(clamped) / 2;
  return (
    <span
      className={styles.centreBar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <span
        className={styles.centreFill}
        data-side={clamped < 0 ? 'enemy' : undefined}
        style={clamped >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
      />
    </span>
  );
}

export function BarRow({ label, children, value }: { label: string; children: ReactNode; value: string }) {
  return (
    <div className={styles.barRow}>
      <span>{label}</span>
      {children}
      <span className={styles.num}>{value}</span>
    </div>
  );
}

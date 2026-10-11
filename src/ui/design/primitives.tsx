import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './primitives.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'normal' | 'large';
  block?: boolean;
}

export function Button({ variant = 'secondary', size = 'normal', block, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        size === 'large' && styles.large,
        block && styles.block,
        className,
      )}
      {...rest}
    />
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <section className={cx(styles.panel, className)} aria-labelledby={id}>
      <header className={styles.panelHeader}>
        <h2 id={id} className={styles.panelTitle}>
          {title}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export type Tone = 'positive' | 'negative' | 'neutral';

export function Stat({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  testId,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: Tone;
  testId?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} data-testid={testId}>
        {value}
      </span>
      {delta && <span className={cx(styles.statDelta, styles[deltaTone])}>{delta}</span>}
    </div>
  );
}

/** Semicircular 0–100 gauge, coloured by value. */
export function Gauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const colour = clamped >= 50 ? 'var(--green)' : clamped >= 30 ? 'var(--warning)' : 'var(--danger)';
  return (
    <figure
      className={styles.gauge}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <div className={styles.gaugeDial}>
        <svg viewBox="0 0 100 56" aria-hidden="true">
          <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="var(--border)" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M8 50 A42 42 0 0 1 92 50"
            fill="none"
            stroke={colour}
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped} 100`}
          />
        </svg>
        <span className={styles.gaugeValue}>{clamped.toFixed(1)}%</span>
      </div>
      <figcaption className={styles.gaugeLabel}>{label}</figcaption>
    </figure>
  );
}

/** Hover/focus explanation bubble, used for "Why?" breakdowns. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className={styles.tooltipWrap}>
      <button type="button" className={styles.tooltipTrigger} aria-describedby={id}>
        {label}
      </button>
      <span role="tooltip" id={id} className={styles.tooltip}>
        {children}
      </span>
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Kept in a ref so re-renders (the game ticks while menus are open) don't re-run the focus effect.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className={styles.modal}>
        <header className={styles.modalHeader}>
          <h2 id={id} className={styles.modalTitle}>
            {title}
          </h2>
          <Button variant="ghost" aria-label={t('common.close')} onClick={onClose}>
            ✕
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}

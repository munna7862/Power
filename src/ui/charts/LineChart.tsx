import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './charts.module.css';

export interface Point {
  label: string;
  value: number;
}

interface LineChartProps {
  title: string;
  data: readonly Point[];
  format: (value: number) => string;
  height?: number;
  /** Include zero in the y-range (for quantities like debt). */
  zeroBased?: boolean;
}

const PAD = { top: 8, right: 8, bottom: 20, left: 44 };

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  const last = Math.ceil(max / step - 1e-9) * step;
  for (let v = Math.floor(min / step + 1e-9) * step; v <= last + step * 1e-9; v += step) ticks.push(v);
  return ticks;
}

/**
 * Single-series line chart: the title names the series (no legend box), recessive
 * grid, 2px line, and a crosshair that snaps to the nearest month with a tooltip.
 */
export function LineChart({ title, data, format, height = 140, zeroBased = false }: LineChartProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(160, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const latest = data.at(-1);
  const header = (
    <div className={styles.header}>
      <span className={styles.title}>{title}</span>
      {latest && <span className={styles.latest}>{format(latest.value)}</span>}
    </div>
  );

  if (data.length < 2) {
    return (
      <figure className={styles.chart} aria-label={title}>
        {header}
        <div ref={ref} className={styles.plot} style={{ height }}>
          <div className={styles.empty}>{t('charts.empty')}</div>
        </div>
      </figure>
    );
  }

  const values = data.map((d) => d.value);
  let min = Math.min(...values, ...(zeroBased ? [0] : []));
  let max = Math.max(...values);
  if (max - min < 1e-9) {
    min -= Math.abs(min) * 0.1 || 1;
    max += Math.abs(max) * 0.1 || 1;
  }
  const ticks = niceTicks(min, max).filter((t, i, all) => i === 0 || format(t) !== format(all[i - 1] as number));
  min = Math.min(min, ticks[0] ?? min);
  max = Math.max(max, ticks.at(-1) ?? max);

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - PAD.left) / innerW;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
  };

  const hovered = hover === null ? null : data[hover];
  const tooltipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) - 60, 0), width - 130);

  return (
    <figure
      className={styles.chart}
      aria-label={t('charts.latest', { title, value: latest ? format(latest.value) : '' })}
    >
      {header}
      <div ref={ref} className={styles.plot} style={{ height }}>
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className={styles.axisText}>
                {format(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={height - 4} className={styles.axisText}>
            {data[0]?.label}
          </text>
          <text x={width - PAD.right} y={height - 4} textAnchor="end" className={styles.axisText}>
            {latest?.label}
          </text>
          <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
          {hover !== null && hovered && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" />
              <circle
                cx={x(hover)}
                cy={y(hovered.value)}
                r={4}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
        {hovered && (
          <div className={styles.tooltip} style={{ left: tooltipLeft }} role="status">
            <span className={styles.tooltipValue}>{format(hovered.value)}</span>
            <span className={styles.tooltipLabel}>{hovered.label}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

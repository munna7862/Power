import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import mapJson from '../../../content/world/map.json';
import styles from './world.module.css';

const MAP = mapJson as { width: number; height: number; countries: Record<string, string> };
const MAX_ZOOM = 14;
const NEUTRAL = 'color-mix(in srgb, var(--text-faint) 22%, var(--surface))';

interface View {
  k: number;
  x: number;
  y: number;
}
const HOME: View = { k: 1, x: 0, y: 0 };

const clampView = ({ k, x, y }: View): View => ({
  k,
  x: Math.min(0, Math.max(MAP.width * (1 - k), x)),
  y: Math.min(0, Math.max(MAP.height * (1 - k), y)),
});

/** Every country’s outline. Memoised on the fills alone, so panning and zooming never redraw the 200 paths. */
const Countries = memo(function Countries({ fills }: { fills: Record<string, string> }) {
  return (
    <>
      {Object.entries(MAP.countries).map(([id, d]) => (
        <path key={id} d={d} data-id={id} className={styles.country} style={{ fill: fills[id] ?? NEUTRAL }} />
      ))}
    </>
  );
});

export interface WorldMapProps {
  fills: Record<string, string>;
  selected: string | null;
  onSelect(id: string): void;
  nameOf(id: string): string;
  valueOf(id: string): string;
}

/** Interactive SVG world map: drag to pan, wheel or buttons to zoom, hover for details, click to select. */
export function WorldMap({ fills, selected, onSelect, nameOf, valueOf }: WorldMapProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>(HOME);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; id: string | null; moved: boolean } | null>(null);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
      const scale = k / v.k;
      return clampView({ k, x: px - (px - v.x) * scale, y: py - (py - v.y) * scale });
    });
  }, []);

  // A non-passive wheel listener, so zooming the map does not scroll the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(
        e.deltaY < 0 ? 1.25 : 0.8,
        ((e.clientX - rect.left) / rect.width) * MAP.width,
        ((e.clientY - rect.top) / rect.height) * MAP.height,
      );
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const idOf = (target: EventTarget | null): string | null =>
    target instanceof SVGElement ? (target.dataset['id'] ?? null) : null;

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, view, id: idOf(e.target), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const rect = e.currentTarget.getBoundingClientRect();
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      setHover(null);
      setView(
        clampView({
          k: d.view.k,
          x: d.view.x + (dx / rect.width) * MAP.width,
          y: d.view.y + (dy / rect.height) * MAP.height,
        }),
      );
      return;
    }
    const id = idOf(e.target);
    const frame = frameRef.current?.getBoundingClientRect();
    setHover(id && frame ? { id, x: e.clientX - frame.left, y: e.clientY - frame.top } : null);
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d && !d.moved && d.id) onSelect(d.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 40 / view.k;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setView((v) => clampView({ ...v, x: v.x + move[0], y: v.y + move[1] }));
    } else if (e.key === '+' || e.key === '=') zoomAt(1.4, MAP.width / 2, MAP.height / 2);
    else if (e.key === '-') zoomAt(1 / 1.4, MAP.width / 2, MAP.height / 2);
    else if (e.key === '0') setView(HOME);
  };

  const outline = useMemo(() => (selected ? MAP.countries[selected] : undefined), [selected]);
  const hoverPath = hover ? MAP.countries[hover.id] : undefined;
  const transform = `translate(${view.x} ${view.y}) scale(${view.k})`;

  return (
    <div
      ref={frameRef}
      className={styles.frame}
      role="group"
      aria-label={t('world.map.frame')}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="world-map"
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${MAP.width} ${MAP.height}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={t('world.map.image')}
      >
        <rect width={MAP.width} height={MAP.height} className={styles.sea} />
        <g transform={transform} data-testid="map-layer" data-zoom={view.k.toFixed(2)}>
          <Countries fills={fills} />
          {hoverPath && <path d={hoverPath} className={styles.hover} />}
          {outline && <path d={outline} className={styles.selected} />}
        </g>
      </svg>

      <div className={styles.zoom}>
        <button
          type="button"
          aria-label={t('world.map.zoomIn')}
          onClick={() => zoomAt(1.5, MAP.width / 2, MAP.height / 2)}
          disabled={view.k >= MAX_ZOOM}
        >
          +
        </button>
        <button
          type="button"
          aria-label={t('world.map.zoomOut')}
          onClick={() => zoomAt(1 / 1.5, MAP.width / 2, MAP.height / 2)}
          disabled={view.k <= 1}
        >
          −
        </button>
        <button type="button" aria-label={t('world.map.reset')} onClick={() => setView(HOME)} disabled={view.k === 1}>
          ⌂
        </button>
      </div>

      {hover && (
        <div className={styles.tip} role="status" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <strong>{nameOf(hover.id)}</strong>
          <span>{valueOf(hover.id)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Builds the world map artefact content/world/map.json from Natural Earth's India point-of-view admin-0
 * file (public domain). The India POV file draws the boundaries as per the Survey of India: all of Jammu
 * and Kashmir and Ladakh (including the areas under Pakistani and Chinese control) and Arunachal Pradesh are
 * inside India.
 *
 *   curl -L -o ne_10m_admin_0_countries_ind.geojson \
 *     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson
 *   npx tsx tools/world/buildMap.ts ne_10m_admin_0_countries_ind.geojson
 *
 * The output is committed; tests/world/boundary.test.ts is the blocking boundary check on it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { countryId, isCountry, type Feature } from './common';
import { WORLD_HEIGHT, WORLD_WIDTH, project } from '../../content/world/projection';

type Ring = [number, number][];
const EPSILON = 0.22;
const MIN_ISLAND = 0.35;

function perpendicular(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

function douglasPeucker(points: Ring, epsilon: number): Ring {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let worst = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicular(
        points[i] as [number, number],
        points[start] as [number, number],
        points[end] as [number, number],
      );
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > epsilon && index > 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

const area = (ring: Ring): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i] as [number, number];
    const [x2, y2] = ring[(i + 1) % ring.length] as [number, number];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** One closed ring as "M x,y l dx,dy dx,dy … z" with 0.1-unit steps, so the parser in tests stays tiny. */
function ringPath(ring: Ring): string {
  const pts = ring.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)] as const);
  let d = `M${r1((pts[0] as readonly [number, number])[0] / 10)},${r1((pts[0] as readonly [number, number])[1] / 10)}l`;
  const steps: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i] as readonly [number, number];
    const [px, py] = pts[i - 1] as readonly [number, number];
    steps.push(`${(x - px) / 10},${(y - py) / 10}`);
  }
  d += steps.join(' ');
  return `${d}z`;
}

function build(file: string): void {
  const geo = JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] };
  const countries: Record<string, string> = {};
  const centroids: Record<string, [number, number]> = {};
  for (const f of geo.features) {
    const id = countryId(f.properties);
    if (!isCountry(f.properties)) continue;
    const polygons = (
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    ) as number[][][][];
    const projected = polygons.map((poly) =>
      (poly[0] as number[][]).map(([lon, lat]) => project(lon as number, lat as number)),
    );
    const sizes = projected.map((ring) => area(ring));
    const largest = sizes.indexOf(Math.max(...sizes));
    const parts: string[] = [];
    projected.forEach((ring, i) => {
      if (i !== largest && sizes[i]! < MIN_ISLAND) return;
      const simple = douglasPeucker(ring, EPSILON);
      const final = simple.length >= 4 ? simple : ring.length >= 4 ? ring.slice(0, Math.min(ring.length, 6)) : ring;
      if (final.length < 3) return;
      parts.push(ringPath(final));
    });
    if (parts.length === 0) continue;
    countries[id] = parts.join('');
    const big = projected[largest] as Ring;
    const xs = big.map((p) => p[0]);
    const ys = big.map((p) => p[1]);
    centroids[id] = [r1((Math.min(...xs) + Math.max(...xs)) / 2), r1((Math.min(...ys) + Math.max(...ys)) / 2)];
  }
  const out = { width: WORLD_WIDTH, height: WORLD_HEIGHT, countries, centroids };
  writeFileSync(new URL('../../content/world/map.json', import.meta.url), `${JSON.stringify(out)}\n`);
  console.log(`${Object.keys(countries).length} countries, ${JSON.stringify(out).length} bytes`);
}

const input = process.argv[2];
if (!input) throw new Error('Usage: npx tsx tools/world/buildMap.ts <ne_10m_admin_0_countries_ind.geojson>');
build(input);

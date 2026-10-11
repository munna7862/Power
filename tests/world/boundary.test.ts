import { describe, expect, it } from 'vitest';
import { COUNTRY_LIST } from '../../src/sim';
import mapJson from '../../content/world/map.json';
import { unproject } from '../../content/world/projection';

/**
 * Blocking boundary check (Phase 5, sprint 5.1): the committed map must show India's boundaries as per the
 * Survey of India: all of Jammu and Kashmir and Ladakh (including Gilgit-Baltistan and Aksai Chin), and
 * Arunachal Pradesh. Changing the map artefact must not break this.
 */

type Point = [number, number];

/** Parses the "M x,y l dx,dy … z" paths written by tools/world/buildMap.ts into rings of x,y. */
function parsePath(d: string): Point[][] {
  const rings: Point[][] = [];
  for (const part of d.split('z')) {
    if (!part) continue;
    const [start, steps = ''] = part.slice(1).split('l');
    const [sx, sy] = (start as string).split(',').map(Number) as [number, number];
    const ring: Point[] = [[sx, sy]];
    let x = sx;
    let y = sy;
    for (const pair of steps.split(' ')) {
      if (!pair) continue;
      const [dx, dy] = pair.split(',').map(Number) as [number, number];
      x += dx;
      y += dy;
      ring.push([x, y]);
    }
    rings.push(ring);
  }
  return rings;
}

function inside(point: Point, ring: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Point;
    const [xj, yj] = ring[j] as Point;
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const countries = mapJson.countries as Record<string, string>;
const rings = Object.fromEntries(Object.entries(countries).map(([id, d]) => [id, parsePath(d)]));

function ownerOf(lon: number, lat: number): string[] {
  const [px, py] = (() => {
    const scale = 1000 / 360;
    return [(lon + 180) * scale, (84 - lat) * scale] as Point;
  })();
  return Object.entries(rings)
    .filter(([, rs]) => rs.some((r) => inside([px, py], r)))
    .map(([id]) => id);
}

describe('world map: India boundaries as per the Survey of India', () => {
  const inIndia: [string, number, number][] = [
    ['Leh (Ladakh)', 77.58, 34.17],
    ['Srinagar (Kashmir valley)', 74.8, 34.08],
    ['Muzaffarabad (Pakistan-administered Kashmir)', 73.47, 34.37],
    ['Mirpur (Pakistan-administered Kashmir)', 73.75, 33.15],
    ['Gilgit (Gilgit-Baltistan)', 74.31, 35.92],
    ['Skardu (Gilgit-Baltistan)', 75.63, 35.3],
    ['Aksai Chin', 79.5, 35.2],
    ['Tawang (Arunachal Pradesh)', 91.86, 27.59],
    ['Itanagar (Arunachal Pradesh)', 93.6, 27.1],
    ['Kalapani (Uttarakhand)', 80.9, 30.2],
    ['New Delhi', 77.2, 28.6],
    ['Chennai', 80.27, 13.08],
  ];
  it.each(inIndia)('%s is inside India', (_name, lon, lat) => {
    expect(ownerOf(lon, lat)).toContain('IND');
  });

  const outside: [string, number, number, string][] = [
    ['Islamabad', 73.05, 33.7, 'PAK'],
    ['Lahore', 74.35, 31.55, 'PAK'],
    ['Lhasa', 91.1, 29.65, 'CHN'],
    ['Kathmandu', 85.3, 27.7, 'NPL'],
    ['Dhaka', 90.4, 23.8, 'BGD'],
  ];
  it.each(outside)('%s is not inside India', (_name, lon, lat, owner) => {
    const owners = ownerOf(lon, lat);
    expect(owners).not.toContain('IND');
    expect(owners).toContain(owner);
  });

  it('round-trips the projection', () => {
    expect(unproject(0, 0)[1]).toBe(84);
  });

  it('draws every country with a path, and India itself', () => {
    expect(Object.keys(countries).length).toBeGreaterThan(190);
    expect(countries['IND']).toBeDefined();
    for (const c of COUNTRY_LIST) expect(countries[c.id], c.name).toBeDefined();
  });
});

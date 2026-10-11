import type { Gender } from '../sim';

/** Small deterministic generator so a minister always gets the same portrait. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return (n: number) => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) % n;
  };
}

const SKIN = ['#f1c9a5', '#e0ac7e', '#c68b59', '#a8693f', '#8a5230', '#6b3f24'];
const HAIR = ['#1b1b1b', '#2e2018', '#4a3426', '#6d6d6d', '#b9b9b9'];
const ATTIRE = ['#1f3a8a', '#7a1f2b', '#2f5d50', '#5b4a8a', '#8a5a1f', '#33415c', '#f2f2f2'];

/**
 * Procedural, stylised portrait (no real likeness): face, hair, optional glasses
 * and attire colour, all derived from the minister's avatar seed.
 */
export function Avatar({
  seed,
  gender,
  size = 56,
  label,
}: {
  seed: number;
  gender: Gender;
  size?: number;
  label: string;
}) {
  const r = seeded(seed);
  const skin = SKIN[r(SKIN.length)];
  const hair = HAIR[r(HAIR.length)];
  const attire = ATTIRE[r(ATTIRE.length)];
  const glasses = r(4) === 0;
  const longHair = gender === 'female' && r(5) !== 0;
  const bun = gender === 'female' && !longHair;
  const beard = gender === 'male' && r(4) === 0;
  const bald = gender === 'male' && r(6) === 0;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label}>
      <rect width="64" height="64" rx="14" fill="var(--surface-hover)" />
      {longHair && <path d="M14 30c0-14 8-20 18-20s18 6 18 20v20H14z" fill={hair} />}
      <path d="M10 64c2-11 10-16 22-16s20 5 22 16z" fill={attire} />
      <path d="M27 44h10v7H27z" fill={skin} />
      <ellipse cx="32" cy="31" rx="12" ry="14" fill={skin} />
      {!bald && !longHair && <path d="M20 28c0-9 5-14 12-14s12 5 12 14c-3-5-7-7-12-7s-9 2-12 7z" fill={hair} />}
      {longHair && <path d="M20 28c0-9 5-14 12-14s12 5 12 14c-4-4-8-6-12-6s-8 2-12 6z" fill={hair} />}
      {bun && <circle cx="32" cy="13" r="5" fill={hair} />}
      {beard && <path d="M21 33c1 10 6 13 11 13s10-3 11-13c-3 4-7 5-11 5s-8-1-11-5z" fill={hair} />}
      <circle cx="27" cy="31" r="1.4" fill="#1b1b1b" />
      <circle cx="37" cy="31" r="1.4" fill="#1b1b1b" />
      <path d="M28 38c2 1.5 6 1.5 8 0" stroke="#5a3a2a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {glasses && (
        <g stroke="#1b1b1b" strokeWidth="1.2" fill="none">
          <circle cx="27" cy="31" r="3.6" />
          <circle cx="37" cy="31" r="3.6" />
          <path d="M30.6 31h2.8" />
        </g>
      )}
    </svg>
  );
}

/**
 * Indian digit grouping (12,34,56,789) implemented without Intl, so text written
 * into GameState is identical on every platform and ICU build.
 */
export function groupIndian(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.round(Math.abs(value)));
  if (digits.length <= 3) return sign + digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}${rest},${last3}`;
}

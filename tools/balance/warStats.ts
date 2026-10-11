/**
 * War balance probe: declares war on each rival from the opening forces and reports how it goes.
 *   npx tsx tools/balance/warStats.ts [seeds] [days]
 */
import { probeWars } from './wars';

const seeds = Number(process.argv[2] ?? 20);
const days = Number(process.argv[3] ?? 240);

for (const p of probeWars(seeds, days)) {
  console.log(
    p.rival.padEnd(8),
    `won ${p.won}/${p.seeds} lost ${p.lost}/${p.seeds} undecided ${p.undecided}/${p.seeds}`,
    `| mean score ${p.meanScore.toFixed(0)} | mean day ${p.meanDays.toFixed(0)} | India casualties ${p.meanCasualties.toFixed(0)}`,
  );
}

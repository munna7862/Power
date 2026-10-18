import { militaryStrength } from '../../src/sim';
import { BOTS } from './bots';
import { simulate } from './simulate';

const seeds = Number(process.argv[2] ?? 20);
const only = process.argv[3];
for (const bot of BOTS.filter((b) => !only || b.id === only)) {
  let wars = 0;
  const outcomes: Record<string, number> = {};
  const causes: Record<string, number> = {};
  let readiness = 0;
  let morale = 0;
  let strength = 0;
  let det = 0;
  let funding = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const r = simulate(bot, seed, 5);
    const m = r.final.military;
    wars += m.warHistory.length + m.wars.length;
    for (const h of m.warHistory) outcomes[`${h.rival}:${h.outcome}`] = (outcomes[`${h.rival}:${h.outcome}`] ?? 0) + 1;
    if (r.cause) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
    readiness += m.readiness;
    morale += m.morale;
    strength += militaryStrength(m);
    det += m.deterrence;
    funding += m.fundingRatio;
  }
  const n = seeds;
  console.log(
    bot.id,
    JSON.stringify({ wars, outcomes, causes }),
    `readiness ${(readiness / n).toFixed(1)} morale ${(morale / n).toFixed(1)} strength ${(strength / n).toFixed(1)} det ${(det / n).toFixed(1)} funding ${(funding / n).toFixed(2)}`,
  );
}

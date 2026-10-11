# Phase 4: Military & Defence (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 3](phase_3_domestic_security.md) · [Phase 5 →](phase_5_diplomacy_world.md)

**Phase goal:** the President as Commander-in-Chief. The player builds the armed forces, runs drills, spies on rivals, fights wars and decides on a nuclear program.
**Parity features:** F12, F13, F14, F15, F16 · **Milestone:** **M4: Commander-in-Chief**

> Generic weapon class names only (e.g. "Multirole Fighter Gen 4.5"), with no trademarked product names.

---

## Sprint 4.1: Armed Forces & Procurement (8 SP)

| ID     | Story                                                                                                                                          | SP  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S4.1-1 | As the sim, the military has 12 unit types across land, air, sea and strategic domains, each with cost, upkeep, attack, defence and build time | 3   |
| S4.1-2 | As a player, I order production and procurement into a queue, which is paid from the Defence budget                                            | 2   |
| S4.1-3 | As the sim, readiness, morale and tech level multiply strength; underfunding decays them                                                       | 2   |
| S4.1-4 | As a player, I see a Military screen with forces by domain, a strength index and upkeep                                                        | 1   |

**Tasks**

- [x] `content/weapons.json` with tiers (Gen 1–3 unlocked via defence research)
- [x] Defence research tree (small: 3 tiers × 4 domains)
- [x] Military upkeep is wired into the economy expenditure
- [x] Military loyalty feeds coup risk (from Phase 3)

---

## Sprint 4.2: Drills & Espionage (8 SP)

| ID     | Story                                                                                                                                  | SP  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S4.2-1 | As a player, I order drills (land, air, naval, joint): they cost money and time, raise readiness and morale, and raise deterrence      | 2   |
| S4.2-2 | As a player, I run intelligence ops against a country: recon (reveals its army), sabotage (lowers its readiness), counter-intelligence | 3   |
| S4.2-3 | As the sim, ops can fail and be exposed, which hurts relations and causes a diplomatic incident event                                  | 2   |
| S4.2-4 | As a player, I see enemy strength as "unknown" or as an estimated range until recon reveals it (fog of war)                            | 1   |

**Tasks**

- [x] Drill animation or summary card (lightweight: progress bar and result report)
- [x] Ops success = f(intelligence funding, Director competence, target counter-intelligence, RNG)
- [x] Deterrence score is stored now and used by AI aggression in Phase 5

---

## Sprint 4.3: War, Annexation & Nuclear Program (8 SP)

| ID     | Story                                                                                                                                   | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S4.3-1 | As a player, I can declare war (with diplomatic and approval consequences), and AI nations can declare war on me                        | 2   |
| S4.3-2 | As the sim, wars resolve on fronts in daily rounds: strength × readiness × morale × terrain × RNG, with casualties and equipment losses | 3   |
| S4.3-3 | As a player, I can sue for peace or accept a ceasefire; a decisive victory allows annexation or reparations                             | 1   |
| S4.3-4 | As a player, I can run a nuclear program (research, enrichment, warheads) that adds deterrence; use triggers catastrophic consequences  | 2   |

**Tasks**

- [x] War screen: fronts, progress bar, war weariness, daily report
- [x] War weariness reduces approval over time; victory gives a temporary boost
- [x] Annexation adds GDP and population but also unrest and international sanctions
- [x] Nuclear doctrine choice (No First Use by default); use leads to near-certain global sanctions and game over on Hard
- [x] Balance: a war against a much weaker neighbour is winnable but costly; a war against a peer is a stalemate in most seeds

**Demo (M4):** build up the air force, run a joint drill, recon a rival, defend against an invasion, negotiate a ceasefire.

---

## Phase 4 exit checklist

- [x] War resolver has unit tests for edge cases (zero army, total surrender, ceasefire mid-round)
- [x] Determinism test still green with wars active
- [x] M4 demo scripted in `e2e/military.spec.ts`; screenshots in [docs/screenshots/phase-4](../../docs/screenshots/phase-4)

---

## Balance KPI bands

`npm run balance` (50 seeds × 5 years × 3 bots, plus a war probe of 30 seeds × 240 days per neighbour, Normal). These bands **add to** the Phase 3 bands, which still hold.

| KPI                        | Band                                                                                         | Result at merge (Normal)                               |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `no-early-bankruptcy`      | No bot has debt above 100% of GDP in years 1–2                                               | ✅ 0 runs                                              |
| `passive-loses-early`      | ≥ 50% of passive Presidents are out of office by year 3                                      | ✅ 92%                                                 |
| `balanced-survives`        | Balanced bot completes the term in ≥ 60% of seeds                                            | ✅ 98%                                                 |
| `balanced-beats-passive`   | Balanced completes the term ≥ 30 points more often than passive                              | ✅ 98% vs 0%                                           |
| `greedy-punished`          | Greedy completes the term ≥ 30 points less often than balanced                               | ✅ 0% vs 98%                                           |
| `no-runaway-approval`      | No run ends above 90% approval                                                               | ✅ max 76.0                                            |
| `weak-neighbour-winnable`  | A war on a much weaker neighbour (Haldrin, Velmora) is won within 240 days in ≥ 90% of seeds | ✅ 100% and 100%                                       |
| `wars-are-costly`          | Even a won war costs India more than 5,000 casualties on average                             | ✅ Haldrin 8.9k, Velmora 19.8k, Tirhan 59k, Oruvan 51k |
| `mid-neighbour-takes-time` | A war on a mid-sized neighbour (Tirhan, Oruvan) takes ≥ 60 days on average                   | ✅ 115 and 101 days                                    |
| `peer-war-stalemate`       | A war on the peer (Zarnak) is still undecided after 240 days in ≥ 60% of seeds               | ✅ 97% undecided, 0% won, 3% game over                 |

**Bots:** `balanced` now also runs the armed forces: it spends the procurement fund on a rounded shopping list while upkeep stays below 85% of the Defence budget, runs drills when readiness slips, researches the weakest domain, keeps recon on its most hostile neighbour, runs a counter-intelligence sweep when cover is low, accepts ceasefires, settles victories for reparations and sues for peace before a rout. `passive` and `greedy` ignore the military entirely. Run `npx tsx tools/balance/militaryStats.ts 30` for readiness, morale, strength, deterrence, wars and outcomes by bot, and `npx tsx tools/balance/warStats.ts 30 240` for the war probe.

---

## Delivery notes (2026-10-11)

### What was built

- **Armed forces** (`src/sim/military`, `content/weapons.json`, `content/research.json`): twelve unit types (three per domain: land, air, sea, strategic) with generic class names for generations 1–3, cost, upkeep, attack, defence, build time and crew. Strength is the shared `militaryStrength()` formula (unit points × technology tier × readiness factor × morale factor), used by the monthly system, the war resolver, the bots and the Military screen's "Why?" tooltip.
- **Procurement and funding:** upkeep is paid out of the Defence expenditure line. What is left over each month goes into the **procurement fund** (capped at eight months of Defence spending); orders, research and drills are paid from it, so raising the Defence budget is what buys equipment. A shortfall is covered from the fund while it lasts, then readiness and morale decay toward what funding supports (`readinessTarget`, `moraleTarget`).
- **Defence research:** 3 tiers × 4 domains (tier 1 is the starting tier; tiers 2 and 3 are researched, one project at a time). A higher tier multiplies the domain's strength by 1.25 and 1.6 and raises prices and upkeep.
- **Drills:** land, air, naval and joint exercises cost money from the fund and take 21–45 days, then raise readiness, morale and deterrence; each can end in an accident (morale and gains are cut). The Military screen shows a progress bar while they run and a report card afterwards.
- **Espionage and fog of war:** recon, sabotage and counter-intelligence operations. Success is `opSuccessChance()`: intelligence funding, the Director's competence, the target's counter-intelligence and the operation's difficulty. A blown operation costs relations and approval and raises a `diplomatic-incident` decision about the rival. Rival strength is shown as **unknown**, a wide **estimate** (when intelligence is funded) or a **sighting range** that widens over a year (`strengthView()`).
- **War:** `DECLARE_WAR` (mobilisation cost, approval and relations penalties) or a rival's declaration (after the first year; the chance rises with its aggression and bad relations and falls with India's deterrence and strength). Each day every front plays one round (`frontRound`: strength × readiness × morale × terrain × luck, with terrain favouring the weaker side), with casualties, equipment losses, war cost and weariness. Fronts weigh the four domains differently, so a force that neglected its navy cannot win a sea war. Endings: ceasefire offers, `SUE_FOR_PEACE`, or a decisive victory followed by the choice of **annexation** (GDP and population up, unrest in the border region, three years of sanctions), **reparations** or a **magnanimous peace** (default after 30 days: reparations). A rout ends the presidency (`defeat`).
- **Nuclear program:** research (3 years), then enrichment (2 years), then a warhead every four months, with a monthly bill, sanctions pressure once the program is visible and a deterrence bonus. Doctrine is No First Use by default; a first strike needs the doctrine changed (approval and relations cost). Use brings five years of global sanctions, an approval collapse, nationwide unrest and hostile neighbours; on **Hard** it ends the presidency (`nuclear`).
- **Military screen** with Forces, Drills & Intelligence, War and Nuclear tabs, a war banner on every other screen while at war, and a confirmation dialog before declaring war or ordering a nuclear strike.
- **Events:** 16 new `military` events (pay disputes, procurement scandals, border incidents, war protests, war bonds, nuclear pressure and more). New effect types `readiness`, `morale` and `relation`, new condition stats and a `{rival}` placeholder.
- **Army loyalty** now follows morale and Defence funding (it was a Phase 3 placeholder), so neglecting the forces raises coup risk. **Border tension** follows the most hostile neighbour (and is 85 at war).
- **Save v4:** migration from v3 (the forces start from their opening state) and golden fixture `tests/fixtures/saves/v4.json`.

### Deviations from the plan

- **Rivals are fictional states** (`content/rivals.json`: Zarnak, Tirhan, Oruvan, Velmora, Haldrin) rather than real countries. A war against a real nation needs the neutral-tone review and the Survey of India map, which arrive with Phase 5's world map. The five states are stand-ins (one peer, two mid-sized, two weak neighbours) that Phase 5's `countries.json` will replace.
- **Upkeep is not a separate expenditure line.** It is carved out of the existing Defence line, so the economy's `FiscalMonth` shape is unchanged. War costs are charged to the treasury each day and show up as borrowing at the next monthly settlement.
- **Drill "animation"** is a progress bar and a result card, as the plan allows.
- **Rivals never use nuclear weapons.** A nuclear-armed enemy that is losing hints at "extraordinary measures" and offers a ceasefire; that is the only escalation modelled.
- **Peace terms after a victory** are chosen on the War screen (with a 30-day default) rather than through the inbox.
- **Two new game-over causes** (`defeat`, `nuclear`) extend the Phase 3 list.
- **Hostile spies:** rivals occasionally probe India's defences, and counter-intelligence cover reduces the damage. This was not in the plan; it gives counter-intelligence a purpose.

### Sensitivity review (master plan §1.3)

| Check                       | Result                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Original text only          | ✅ all unit, event and rival text written for this project; generic weapon classes only (no product names)  |
| Fictional people and groups | ✅ five invented states; no real country, party, politician or armed force is named                         |
| No religion or caste        | ✅ war, border and espionage text is about armies, terrain, money and approval only                         |
| Non-graphic writing         | ✅ casualties are figures in a report; the nuclear strike is described by its political and economic result |
| India boundaries            | ✅ still no boundary drawn; fronts are listed by name and terrain, not on a map                             |

### Known issues → Phase 5 backlog

- Phase 5 should replace the fictional rivals with `countries.json`, move relations and border tension into the diplomacy system, and let AI nations act through `dispatch()` (including `DECLARE_WAR`) with `deterrence` in their utility.
- A hands-off President now leaves office by year 3 in 92% of seeds (Phase 3: 70%); the extra military decisions that lapse (indecision penalty) are part of the reason. The band is "≥ 50%", so it still holds.
- The balanced bot ends wars only by ceasefire, reparations or asking for peace; it never annexes or declares war, so those paths are covered by unit and e2e tests rather than by the balance run.
- Wars with the peer rarely resolve without a ceasefire, and there is no wartime conscription or mobilisation lever yet.

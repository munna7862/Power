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

- [ ] `content/weapons.json` with tiers (Gen 1–3 unlocked via defence research)
- [ ] Defence research tree (small: 3 tiers × 4 domains)
- [ ] Military upkeep is wired into the economy expenditure
- [ ] Military loyalty feeds coup risk (from Phase 3)

---

## Sprint 4.2: Drills & Espionage (8 SP)

| ID     | Story                                                                                                                                  | SP  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S4.2-1 | As a player, I order drills (land, air, naval, joint): they cost money and time, raise readiness and morale, and raise deterrence      | 2   |
| S4.2-2 | As a player, I run intelligence ops against a country: recon (reveals its army), sabotage (lowers its readiness), counter-intelligence | 3   |
| S4.2-3 | As the sim, ops can fail and be exposed, which hurts relations and causes a diplomatic incident event                                  | 2   |
| S4.2-4 | As a player, I see enemy strength as "unknown" or as an estimated range until recon reveals it (fog of war)                            | 1   |

**Tasks**

- [ ] Drill animation or summary card (lightweight: progress bar and result report)
- [ ] Ops success = f(intelligence funding, Director competence, target counter-intelligence, RNG)
- [ ] Deterrence score is stored now and used by AI aggression in Phase 5

---

## Sprint 4.3: War, Annexation & Nuclear Program (8 SP)

| ID     | Story                                                                                                                                   | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S4.3-1 | As a player, I can declare war (with diplomatic and approval consequences), and AI nations can declare war on me                        | 2   |
| S4.3-2 | As the sim, wars resolve on fronts in daily rounds: strength × readiness × morale × terrain × RNG, with casualties and equipment losses | 3   |
| S4.3-3 | As a player, I can sue for peace or accept a ceasefire; a decisive victory allows annexation or reparations                             | 1   |
| S4.3-4 | As a player, I can run a nuclear program (research, enrichment, warheads) that adds deterrence; use triggers catastrophic consequences  | 2   |

**Tasks**

- [ ] War screen: fronts, progress bar, war weariness, daily report
- [ ] War weariness reduces approval over time; victory gives a temporary boost
- [ ] Annexation adds GDP and population but also unrest and international sanctions
- [ ] Nuclear doctrine choice (No First Use by default); use leads to near-certain global sanctions and game over on Hard
- [ ] Balance: a war against a much weaker neighbour is winnable but costly; a war against a peer is a stalemate in most seeds

**Demo (M4):** build up the air force, run a joint drill, recon a rival, defend against an invasion, negotiate a ceasefire.

---

## Phase 4 exit checklist

- [ ] War resolver has unit tests for edge cases (zero army, total surrender, ceasefire mid-round)
- [ ] Determinism test still green with wars active
- [ ] M4 demo recorded

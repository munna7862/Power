# Phase 5: Diplomacy & World (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 4](phase_4_military.md) · [Phase 6 →](phase_6_polish_release.md)

**Phase goal:** India on the world stage. An interactive world map, living AI nations, trade contracts and treaties.
**Parity features:** F17, F18, F19 · **Milestone:** **M5: World Stage (feature parity reached)**

---

## Sprint 5.1: World Map & Countries (8 SP)

| ID     | Story                                                                                           | SP  |
| ------ | ----------------------------------------------------------------------------------------------- | --- |
| S5.1-1 | As a player, I see an interactive SVG world map (pan, zoom, hover, select)                      | 3   |
| S5.1-2 | As the sim, about 195 countries have GDP, power, ideology, aggression and a relation with India | 2   |
| S5.1-3 | As a player, I open a Country panel: stats, relation, treaties, available actions               | 2   |
| S5.1-4 | As a player, map overlays show relation, power, trade and war                                   | 1   |

**Tasks**

- [ ] Build script: Natural Earth **India point-of-view** admin-0 → TopoJSON → simplified SVG paths (committed artefact)
- [ ] Verify India's boundaries render as per the Survey of India (J&K, Ladakh, Arunachal Pradesh) — **blocking check**
- [ ] `content/countries.json` generated from public data (rounded), with manual tuning for about 20 focus nations
- [ ] Map performance target: 60 fps pan and zoom on a mid-range laptop

---

## Sprint 5.2: Relations, Trade Contracts & Treaties (8 SP)

| ID     | Story                                                                                                      | SP  |
| ------ | ---------------------------------------------------------------------------------------------------------- | --- |
| S5.2-1 | As a player, I propose trade contracts (resource or sector, duration, value) that add revenue and relation | 3   |
| S5.2-2 | As a player, I sign non-aggression pacts, open embassies, send aid, or impose sanctions                    | 2   |
| S5.2-3 | As the sim, relations drift with ideology match, trade, incidents and espionage exposure                   | 2   |
| S5.2-4 | As a player, I see a Diplomacy screen listing active treaties, expiring deals and offers                   | 1   |

**Tasks**

- [ ] Treaty model: `{ type, parties, startDate, endDate, terms }`
- [ ] Trade revenue goes into the economy as a customs and sector boost
- [ ] Breaking a treaty causes a global reputation penalty

---

## Sprint 5.3: AI Nations & Global Events (8 SP)

| ID     | Story                                                                                                                                     | SP  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S5.3-1 | As the sim, focus-set AI (about 20 nations) evaluates monthly: offer a deal, threaten, declare war, or seek a pact, using utility scoring | 3   |
| S5.3-2 | As the sim, the other nations use a simplified AI (relation drift and random incidents)                                                   | 1   |
| S5.3-3 | As the sim, global events (oil shock, recession, pandemic, regional conflict) affect everyone                                             | 2   |
| S5.3-4 | As a developer, the AI has a debug overlay showing why a nation chose an action                                                           | 2   |

**Tasks**

- [ ] Utility = w1·relation + w2·powerRatio + w3·ideologyMatch + w4·deterrence(India) + RNG noise
- [ ] AI uses the same command API as the player (no cheating paths)
- [ ] About 20 global and diplomatic events
- [ ] Performance: a full year of ticks with all AI takes < 2 s headless

**Demo (M5):** sign a trade contract with a focus nation, a pact with a neighbour, and survive a regional crisis. Tick all parity features F1–F20 in the [master plan](../Master/master_plan.md).

---

## Phase 5 exit checklist

- [ ] **Parity checklist 100% ticked**
- [ ] Map boundary compliance check signed off
- [ ] M5 demo recorded

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

- [x] Build script: Natural Earth **India point-of-view** admin-0 → simplified SVG paths (committed artefact `content/world/map.json`, built by `tools/world/buildMap.ts`)
- [x] Verify India's boundaries render as per the Survey of India (J&K, Ladakh, Arunachal Pradesh) — **blocking check** (`tests/world/boundary.test.ts`)
- [x] `content/countries.json` generated from public data (rounded), with manual tuning for about 20 focus nations (`tools/world/buildCountries.ts`)
- [x] Map performance target: 60 fps pan and zoom on a mid-range laptop (the 200 outlines are memoised; panning and zooming only change one `transform`)

---

## Sprint 5.2: Relations, Trade Contracts & Treaties (8 SP)

| ID     | Story                                                                                                      | SP  |
| ------ | ---------------------------------------------------------------------------------------------------------- | --- |
| S5.2-1 | As a player, I propose trade contracts (resource or sector, duration, value) that add revenue and relation | 3   |
| S5.2-2 | As a player, I sign non-aggression pacts, open embassies, send aid, or impose sanctions                    | 2   |
| S5.2-3 | As the sim, relations drift with ideology match, trade, incidents and espionage exposure                   | 2   |
| S5.2-4 | As a player, I see a Diplomacy screen listing active treaties, expiring deals and offers                   | 1   |

**Tasks**

- [x] Treaty model: `{ type, parties, startTick, endTick, terms }` (`Treaty` in `src/sim/state/types.ts`)
- [x] Trade revenue goes into the economy as a customs and sector boost (new `economy.customs` modifier target plus `economy.growth.<sector>`)
- [x] Breaking a treaty causes a global reputation penalty

---

## Sprint 5.3: AI Nations & Global Events (8 SP)

| ID     | Story                                                                                                                                     | SP  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S5.3-1 | As the sim, focus-set AI (about 20 nations) evaluates monthly: offer a deal, threaten, declare war, or seek a pact, using utility scoring | 3   |
| S5.3-2 | As the sim, the other nations use a simplified AI (relation drift and random incidents)                                                   | 1   |
| S5.3-3 | As the sim, global events (oil shock, recession, pandemic, regional conflict) affect everyone                                             | 2   |
| S5.3-4 | As a developer, the AI has a debug overlay showing why a nation chose an action                                                           | 2   |

**Tasks**

- [x] Utility = w1·relation + w2·powerRatio + w3·ideologyMatch + w4·deterrence(India) + RNG noise
- [x] AI uses the same command API as the player (no cheating paths)
- [x] About 20 global and diplomatic events (22 in `content/events/diplomacy.json`)
- [x] Performance: a full year of ticks with all AI takes < 2 s headless (about 0.04 s measured; `tests/sim/diplomacy.test.ts`)

**Demo (M5):** sign a trade contract with a focus nation, a pact with a neighbour, and survive a regional crisis. Tick all parity features F1–F20 in the [master plan](../Master/master_plan.md).

---

## Phase 5 exit checklist

- [x] **Parity checklist ticked** for everything Phase 5 owns (F17, F18, F19). F20 (term victory) completes in Phase 6, as the master plan schedules it
- [x] Map boundary compliance check signed off (`tests/world/boundary.test.ts`; see the sensitivity review below)
- [x] M5 demo scripted in `e2e/diplomacy.spec.ts`; screenshots in [docs/screenshots/phase-5](../../docs/screenshots/phase-5)

---

## Balance KPI bands

`npm run balance` (50 seeds × 5 years × 3 bots, plus the war probe, Normal). These bands **add to** the Phase 3 and 4 bands, which still hold. The war probe now names real neighbours; the profiles keep the strength, terrain and aggression of the Phase 4 stand-ins they replace.

| KPI                        | Band                                                                                              | Result at merge (Normal)                 |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `no-early-bankruptcy`      | No bot has debt above 100% of GDP in years 1–2                                                    | ✅ 0 runs                                |
| `passive-loses-early`      | ≥ 50% of passive Presidents are out of office by year 3                                           | ✅ 88%                                   |
| `balanced-survives`        | Balanced bot completes the term in ≥ 60% of seeds                                                 | ✅ 96%                                   |
| `balanced-beats-passive`   | Balanced completes the term ≥ 30 points more often than passive                                   | ✅ 96% vs 0%                             |
| `greedy-punished`          | Greedy completes the term ≥ 30 points less often than balanced                                    | ✅ 0% vs 96%                             |
| `no-runaway-approval`      | No run ends above 90% approval                                                                    | ✅ max 77.0                              |
| `weak-neighbour-winnable`  | A war on a much weaker neighbour (Sri Lanka, Bangladesh) is won within 240 days in ≥ 90% of seeds | ✅ 97% and 97%                           |
| `wars-are-costly`          | Even a won war costs India more than 5,000 casualties on average                                  | ✅ LKA 7.0k, BGD 19.4k, PAK 60k, MMR 52k |
| `mid-neighbour-takes-time` | A war on a mid-sized neighbour (Pakistan, Myanmar) takes ≥ 60 days on average                     | ✅ 118 and 104 days                      |
| `peer-war-stalemate`       | A war on the peer (China) is still undecided after 240 days in ≥ 60% of seeds                     | ✅ 100% undecided                        |
| `foreign-policy-pays`      | The balanced bot signs at least one trade contract during the term in ≥ 80% of completed terms    | ✅ 100%                                  |
| `reputation-holds`         | Mean reputation of completed balanced terms stays between 50 and 80                               | ✅ 78.3                                  |
| `partners-make-offers`     | Other countries propose a deal to India during the term in ≥ 80% of balanced runs                 | ✅ 100%                                  |
| `ai-war-frequency`         | Rivals invade India in at least 2% and at most 60% of all runs (a threat, not a certainty)        | ✅ 4%                                    |

**Bots:** `balanced` now also runs foreign policy: it answers every offer (while it has trade slots), opens up to four embassies with the most powerful nations it can, signs trade contracts with the countries most likely to agree (while it holds fewer than four) and seeks a pact with the neighbour most likely to accept. `passive` and `greedy` ignore diplomacy. The harness's `tools/balance/diplomacy.ts` holds the Phase 5 bands.

---

## Delivery notes (2026-10-11)

### What was built

- **World map** (`content/world/map.json`, `src/ui/map/`): 206 countries as simplified SVG outlines in an equirectangular projection, built by `tools/world/buildMap.ts` from Natural Earth's public-domain **India point-of-view** file (about 250 KB committed). Pan by dragging, zoom with the wheel, the buttons or `+`/`-`, hover for a tooltip, click to select; arrow keys pan and `0` resets. The 200 paths are rendered once per overlay and never again on pan or zoom. Overlays colour the map by **relation**, **power**, **trade** and **war** (wars, crises between other states, countries sanctioning India, hostile states), each with a legend.
- **Countries** (`content/countries.json`, `src/sim/content/world.ts`): 205 countries with rounded GDP and population from the same Natural Earth file, plus rule-derived power, outlook, aggression, opening relation and sector strengths. About 20 focus nations (the neighbours, the great powers, the energy exporters and the large emerging economies) are tuned by hand in `tools/world/buildCountries.ts`. Outlook is a coarse abstraction on India's ideology scale, used only for the ideology-match term.
- **Country panel** on the World screen: stats, relation with a **"Why?"** breakdown (`relationDrivers()` is the same function the monthly drift uses), treaties with India, a trade-contract form with live acceptance odds, a pact, an embassy, three aid packages and sanctions (with a confirmation). Rivals also show their army strength through the fog of war.
- **Relations** (`src/sim/diplomacy/relations.ts`): every country's relation with India lives in `state.diplomacy.countries` (it moved out of the military state). Each month it drifts 8% toward a target built from the starting attitude, ideology match, trade contracts, embassy, pact, sanctions, India's reputation, recent incidents, war and world tension. Exposed spies and broken deals add incidents that fade over months.
- **Trade contracts, pacts, embassies, aid and sanctions** (`treaties.ts`): contracts have a sector, a size (small, medium or large share of GDP, capped by the partner's economy) and a term of one, three or five years. They add a growth modifier to the sector and a customs-revenue multiplier for their term, and warm relations; acceptance is a roll with published odds. Up to six contracts at once. Pacts last five years and make that country's war declaration impossible. Embassies cost ₹400 crore and ₹15 crore a month. Aid trades money for relation and reputation, and sanctions end trade with a country at a customs cost.
- **Reputation and world tension**: breaking a pact costs 14 reputation points, a contract 6, attacking a partner 8 more, an annexation 15 and a nuclear strike 40; honoured treaties, embassies and aid rebuild it, slowly (4% a month toward a target). World tension rises with crises between other states and shocks, and cools the mood everywhere.
- **AI nations** (`ai.ts`): each month the 20 focus nations score six actions (offer a deal, seek a pact, threaten, sanction India, declare war, do nothing) from relation, power ratio, ideology match and India's deterrence plus noise, and act in about one month in five. Deals and pacts arrive as **offers** with a 90-day answer window; threats, sanctions and wars go through the same functions the player uses (`signTreaty`, `adjustRelation`, `startWar`). A rival's war needs the Phase 4 declaration roll as well as preferring war to doing nothing, and is impossible under a pact. The other 185 countries only drift and have rare incidents.
- **Events** (`content/events/diplomacy.json`): 22 new events. Ten global shocks (oil shock, recession, a pandemic, a regional conflict, a commodity boom, a technology boom, food prices, financial turmoil, shipping disruption, a climate summit) and twelve diplomatic decisions about a country picked when the event fires (summit invitation, trade dispute, border talks, expelled diplomat, sanctions pressure, an arms order, displaced people, an aid request, joint exercises, a naval stand-off, a trade expo, a UN vote). New effect types `worldRelation`, `reputation`, `worldTension`, `conflict` and `treaty`; `relation` now names any country; new `{country}` placeholder (also filled in choice text and outcomes) and a `countryPick` field; new stats (`reputation`, `worldTension`, `tradeDeals`, `pacts`, `avgRelation`, `conflicts`, `sanctionsOnIndia`).
- **Diplomacy screen**: reputation and tension tiles with a "Why?", offers to accept or decline, deals expiring within six months with a renew shortcut, a table of active treaties (ending one needs a confirmation), sanctions and crises, the major nations' attitudes and last moves, and a development-only **AI debug overlay** showing each nation's inputs and the utility of every action. A banner on every screen announces waiting offers.
- **Saves**: schema v5 with a v4 → v5 migration (see below) and the golden fixture `tests/fixtures/saves/v5.json`.

### Deviations from the plan

- **The fictional rivals are replaced by real neighbours** (`content/rivals.json`): China (peer), Pakistan and Myanmar (mid-sized), Bangladesh and Sri Lanka (weak). Each keeps the strength, growth, counter-intelligence and economic weight of its Phase 4 stand-in, so the war balance bands carry over; the fronts are named for terrain, never for disputed places. Pakistan is now armed with nuclear weapons, as China is. A v4 save is migrated slot for slot (Zarnak → China, Tirhan → Pakistan, Oruvan → Myanmar, Velmora → Bangladesh, Haldrin → Sri Lanka) and keeps its wars, operations and relations.
- **Aggression lives in one place.** The rivals' `aggression` field was dropped from `rivals.json`; `content/countries.json` is the source for every country, rivals included.
- **A rival's declaration of war moved** from the military system into the diplomacy system's AI step. The probability is still `declarationChance()`; the AI adds a gate (it must prefer war to doing nothing) and a pact now blocks it.
- **TopoJSON was skipped.** The build script writes simplified SVG paths directly (Douglas-Peucker, about 0.08° tolerance) because shared borders do not need to be topologically exact at this scale.
- **Embassies are treaties** with no end date, and they do not yet unlock anything beyond a relation bonus, better odds and a monthly bill. Espionage is still run from the Military screen.
- **A passive President falls a little earlier** in some seeds because more decisions lapse (the indecision penalty applies to warning and critical events); the Phase 3 band still holds (88% out by year 3). `tests/tools/balance.test.ts` now uses a seed that survives two passive years.

### Sensitivity review (master plan §1.3)

| Check                       | Result                                                                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original text only          | ✅ all event, country-panel and treaty text written for this project; Natural Earth is public domain                                                                                                                                                                                                |
| Fictional people and groups | ✅ no real politician, party or organisation is named. Countries are real; leaders and governments are never mentioned                                                                                                                                                                              |
| No religion or caste        | ✅ the 22 events and the country text deal in trade, security, shocks and aid; "outlook" is a five-way abstraction and is not shown as a political judgement                                                                                                                                        |
| Non-graphic writing         | ✅ conflicts and displaced people are described by their economic and political effects; wars are figures in a report                                                                                                                                                                               |
| Neutral tone toward states  | ✅ the same templates and numbers apply to every country; focus-nation tuning is limited to size, temperament and an opening relation; no dispute is described                                                                                                                                      |
| India boundaries            | ✅ the map is built from the India point-of-view file. All of Jammu and Kashmir and Ladakh (Gilgit-Baltistan and Aksai Chin included) and Arunachal Pradesh lie inside India; `tests/world/boundary.test.ts` checks twelve points inside and five outside and blocks any map change that moves them |

### Known issues → Phase 6 backlog

- The war front list is still shown by name only; a map view of the fronts would need the India detail view the master plan lists for F17 ("an India detail view"). The map already zooms to India, but there is no dedicated state-level view yet.
- Country text is generic. A few country-specific lines for the focus nations would help; so would a neutral-tone pass by a second reviewer before the public release.
- Relations among the other countries are not simulated (they only react to India), so there are no alliances or blocs. A bloc layer is a natural Phase 7 addition.
- The 185 non-focus countries cannot make offers. Only the focus nations propose deals.
- Trade values are abstract shares of GDP, not goods; "resource" contracts are expressed through the sector they boost (energy for oil and gas, agriculture for grain).
- The AI debug overlay shows only in development builds; a hidden toggle in release builds would help support.
- The balanced bot never declares war, annexes or sanctions; those paths are covered by unit and e2e tests.

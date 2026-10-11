# Phase 3: Domestic Affairs & Security (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 2](phase_2_economy_governance.md) · [Phase 4 →](phase_4_military.md)

**Phase goal:** the country pushes back. Emergencies, corruption, riots, terror and threats to the President create pressure and decisions.
**Parity features:** F1 (inbox), F7, F8, F9, F10, F11, F20 · **Milestone:** **M3: Crisis Manager**

> **Content rule:** unrest and terror are modelled by **region and cause** (economic, regional, law and order, external). Groups are fictional. Never frame events by religion, caste or a real organisation.

---

## Sprint 3.1: Event Engine & Presidential Inbox (8 SP)

**Goal:** a data-driven event system that every later system plugs into.

| ID     | Story                                                                                                | SP  |
| ------ | ---------------------------------------------------------------------------------------------------- | --- |
| S3.1-1 | As a designer, I write events in JSON with conditions, weight, choices and effects                   | 3   |
| S3.1-2 | As the sim, I roll events daily using the seeded RNG, with cooldowns and follow-up chains            | 2   |
| S3.1-3 | As a player, I get an inbox (daily briefings, decisions) and the game auto-pauses on critical events | 2   |
| S3.1-4 | As a developer, invalid event JSON fails CI with a clear message                                     | 1   |

**Tasks**

- [x] Event schema (zod): `id, category, severity, conditions[], weight, cooldownDays, choices[{label, effects[], followUp?}]`
- [x] Condition DSL: `{ stat: "unemployment", op: ">", value: 8 }`, plus `all` and `any`
- [x] Effects are modifiers, so they are shown automatically in "Why?" tooltips
- [x] Inbox UI: unread badge, filters, decision modal
- [x] 25 starter events (economy and personal) to prove the pipeline

---

## Sprint 3.2: Emergencies, Corruption & Unrest (8 SP)

| ID     | Story                                                                                                                                                                 | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S3.2-1 | As the sim, natural disasters (flood, cyclone, earthquake, drought, epidemic, heatwave) hit regions, and response quality depends on the Disaster Management ministry | 3   |
| S3.2-2 | As the sim, a corruption index leaks budget; the player can fund an anti-corruption agency and launch investigations into ministers                                   | 2   |
| S3.2-3 | As the sim, unrest per region (about 6 macro-regions) rises with unemployment and inflation and triggers riots; police funding and response choices resolve it        | 3   |

**Tasks**

- [x] Regions: North, South, East, West, Central, North-East (with an India SVG map coloured by unrest)
- [x] Disaster response choices: deploy NDRF, request army help, relief package (₹), do nothing
- [x] Investigation command: costs money and time, may expose a minister (scandal event)
- [x] About 40 events across disaster, corruption and unrest

---

## Sprint 3.3: Terror, Presidential Security & Game Over States (8 SP)

| ID     | Story                                                                                                                                      | SP  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| S3.3-1 | As the sim, terror threat rises with low intelligence funding and border tension; fictional groups plan attacks that intelligence may foil | 3   |
| S3.3-2 | As the sim, presidential safety depends on security funding and loyalty; assassination attempts can fail or succeed                        | 2   |
| S3.3-3 | As the sim, all game over states exist: impeachment, coup, assassination, bankruptcy (debt-to-GDP > threshold for 12 months)               | 2   |
| S3.3-4 | As a player, I see a Security screen (threat levels, police, intelligence, agencies)                                                       | 1   |

**Tasks**

- [x] Counter-terror operations: raid (risky), surveillance (slow), border sealing (economic cost)
- [x] Coup risk formula: f(military loyalty, defence minister loyalty, approval)
- [x] About 30 security and terror events (fictional groups, non-graphic writing)
- [x] Difficulty affects event frequency and severity
- [x] Balance run: the median passive bot loses by year 3; the balanced bot survives the term in ≥ 60% of seeds

**Demo (M3):** a flood hits the East; choose the relief response; a corruption scandal breaks; a terror plot is foiled thanks to intelligence funding; game over by impeachment when approval collapses.

---

## Phase 3 exit checklist

- [x] ≥ 90 events in content, all schema-valid
- [x] Sensitivity review of all event text (checklist in the master plan §1.3)
- [x] M3 demo scripted in `e2e/crisis.spec.ts`; screenshots in [docs/screenshots/phase-3](../../docs/screenshots/phase-3)

---

## Balance KPI bands

`npm run balance` (50 seeds × 5 years × 3 bots, Normal). These bands **replace** the Phase 2 bands: with crises in the game a hands-off President is no longer expected to survive.

| KPI                      | Band                                                            | Result at merge (Normal) |
| ------------------------ | --------------------------------------------------------------- | ------------------------ |
| `no-early-bankruptcy`    | No bot has debt above 100% of GDP in years 1–2                  | ✅ 0 runs                |
| `passive-loses-early`    | ≥ 50% of passive Presidents are out of office by year 3         | ✅ 70%                   |
| `balanced-survives`      | Balanced bot completes the term in ≥ 60% of seeds               | ✅ 98%                   |
| `balanced-beats-passive` | Balanced completes the term ≥ 30 points more often than passive | ✅ 98% vs 2%             |
| `greedy-punished`        | Greedy completes the term ≥ 30 points less often than balanced  | ✅ 0% vs 98%             |
| `no-runaway-approval`    | No run ends above 90% approval                                  | ✅ max 75.5              |

**Bots:** `passive` never acts and lets every decision lapse; `greedy` raises every tax at once and ignores decisions; `balanced` also settles each decision by its listed effects (`choiceUtility`), funds police and intelligence under pressure, opens corruption inquiries, keeps surveillance running and fills vacancies. Run `npx tsx tools/balance/diagnose.ts <bot> <seeds>` for year-by-year unrest, threat, coup risk and event counts.

---

## Delivery notes (2026-10-11)

### What was built

- **Event engine** (`src/sim/events`, `content/events/*.json`): 104 events in seven files, validated by zod at load (`src/sim/content/events.ts`; a bad event fails `npm test` naming the file and event id). Conditions are `{stat, op, value}` with `all`/`any`; stats are in percent units. Each event has an expected-per-year `weight`, a cooldown, a decision deadline and choices with effects, cost, outcome text and optional follow-up events. Effects are modifiers, so they show in the "Why?" tooltips; ministry quality scales them (`mitigate`/`amplify`), and difficulty scales harm and frequency (Easy 0.85× harm and 0.8× frequency, Hard 1.2× and 1.25×).
- **Inbox:** a new Inbox screen (filters, unread badge, decision dialog that lists every effect before you choose), a banner for waiting decisions, and auto-pause when a critical entry or new decision arrives (`advanceUntilAttention`). Undecided decisions apply their default after the deadline.
- **Regions, unrest and disasters:** six macro-regions with unrest driven by jobs, prices, corruption, approval and Home-ministry funding; riots trigger at 62+. Disasters are regional and seasonal; the Disaster Management ministry (or Health or Agriculture where apt) scales how much damage each response lets through.
- **Corruption:** the national index now leaks every ministry's money (`nationalLeakageFactor`); `LAUNCH_INVESTIGATION` costs ₹1,500 cr, takes 60 days and may expose a minister, with the chance set by that minister's corruption and the Anti-corruption ministry.
- **Terror:** fictional groups form plots (chance rises with the threat); intelligence may foil them first; the rest raise a warning decision with a deadline. `LAUNCH_OPERATION` (raid, surveillance, border seal) and the warning choices share the same operations. Attacks hit approval, unrest and growth.
- **Game over:** impeachment, coup (military loyalty, defence minister loyalty, approval), assassination (presidential safety), bankruptcy (debt above 120% of GDP for 12 months). Each is covered by a unit test.
- **Security screen:** terror threat with "Why?", regional unrest map and table with "Why?", presidential safety, the four threats to your presidency, live plots, operations, agencies and inquiries.
- **Save v3:** migration from v2 (and v1 through v2), golden fixture `tests/fixtures/saves/v3.json`.

### Deviations from the plan

- **The unrest map is a schematic tile map, not an outline of India.** Maps must follow the Survey of India's boundaries and we have no vetted boundary data yet, so the map draws no borders and says so. The real map arrives with the Phase 5 world map (Natural Earth India point-of-view data).
- **Voters now also judge "Safety and order"** (unrest and terror); the other approval weights were trimmed to make room. Unrest and terror also drag growth (new `disorder` growth driver).
- **Letting a crisis decision lapse costs approval** ("Seen as indecisive": −2.5 for warnings, −7 for critical events, for 180 days). This is what makes a passive President lose by year 3, as the plan requires; it is a deliberate design choice.
- **Daily briefings** were not added: the monthly report cadence from Phase 2 keeps the inbox readable at 4×.
- **Event totals:** 104 events (25 economy and personal, 49 disaster, corruption and unrest, 29 security and terror).
- **Presidential safety is derived**, not a stored stat, so there is no separate "protection detail" purchase; funding Home and Intelligence is the lever.
- Real institutions are described generically in event text ("the national disaster response force", "the national audit office"); a test blocks religious, caste and real party or group names.

### Sensitivity review (master plan §1.3)

| Check                                               | Result                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Original text only                                  | ✅ all event text written for this project                                                                                                             |
| Fictional people and groups                         | ✅ eight invented group names in `content/groups.json`; no real politicians, parties or militant groups (blocklist test in `tests/sim/events.test.ts`) |
| Unrest by region and cause, never religion or caste | ✅ causes are jobs, prices, corruption, resource disputes and policing; regional weights follow geography only (monsoon, coast, seismic belt)          |
| Non-graphic terror writing                          | ✅ attacks are described by place and public reaction only                                                                                             |
| India boundaries                                    | ✅ no boundary is drawn; see deviations                                                                                                                |

### Known issues → Phase 4 backlog

- Military loyalty and border tension are placeholders owned by Phase 4 and Phase 5.
- Bankruptcy is never reached by the bots (debt stays low); a unit test proves it with inflated debt.
- A hands-off President usually falls to impeachment rather than a coup or assassination; those endings need a deliberate security failure.

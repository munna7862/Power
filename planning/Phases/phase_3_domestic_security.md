# Phase 3: Domestic Affairs & Security (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 2](phase_2_economy_governance.md) · [Phase 4 →](phase_4_military.md)

**Phase goal:** the country pushes back. Emergencies, corruption, riots, terror and threats to the President create pressure and decisions.
**Parity features:** F1 (inbox), F7, F8, F9, F10, F11, F20 · **Milestone:** **M3: Crisis Manager**

> **Content rule:** unrest and terror are modelled by **region and cause** (economic, regional, law and order, external). Groups are fictional. Never frame events by religion, caste or a real organisation.

---

## Sprint 3.1: Event Engine & Presidential Inbox (8 SP)

**Goal:** a data-driven event system that every later system plugs into.

| ID | Story | SP |
|---|---|---|
| S3.1-1 | As a designer, I write events in JSON with conditions, weight, choices and effects | 3 |
| S3.1-2 | As the sim, I roll events daily using the seeded RNG, with cooldowns and follow-up chains | 2 |
| S3.1-3 | As a player, I get an inbox (daily briefings, decisions) and the game auto-pauses on critical events | 2 |
| S3.1-4 | As a developer, invalid event JSON fails CI with a clear message | 1 |

**Tasks**
- [ ] Event schema (zod): `id, category, severity, conditions[], weight, cooldownDays, choices[{label, effects[], followUp?}]`
- [ ] Condition DSL: `{ stat: "unemployment", op: ">", value: 8 }`, plus `all` and `any`
- [ ] Effects are modifiers, so they are shown automatically in "Why?" tooltips
- [ ] Inbox UI: unread badge, filters, decision modal
- [ ] About 20 starter events (economy and personal) to prove the pipeline

---

## Sprint 3.2: Emergencies, Corruption & Unrest (8 SP)

| ID | Story | SP |
|---|---|---|
| S3.2-1 | As the sim, natural disasters (flood, cyclone, earthquake, drought, epidemic, heatwave) hit regions, and response quality depends on the Disaster Management ministry | 3 |
| S3.2-2 | As the sim, a corruption index leaks budget; the player can fund an anti-corruption agency and launch investigations into ministers | 2 |
| S3.2-3 | As the sim, unrest per region (about 6 macro-regions) rises with unemployment and inflation and triggers riots; police funding and response choices resolve it | 3 |

**Tasks**
- [ ] Regions: North, South, East, West, Central, North-East (with an India SVG map coloured by unrest)
- [ ] Disaster response choices: deploy NDRF, request army help, relief package (₹), do nothing
- [ ] Investigation command: costs money and time, may expose a minister (scandal event)
- [ ] About 40 events across disaster, corruption and unrest

---

## Sprint 3.3: Terror, Presidential Security & Game Over States (8 SP)

| ID | Story | SP |
|---|---|---|
| S3.3-1 | As the sim, terror threat rises with low intelligence funding and border tension; fictional groups plan attacks that intelligence may foil | 3 |
| S3.3-2 | As the sim, presidential safety depends on security funding and loyalty; assassination attempts can fail or succeed | 2 |
| S3.3-3 | As the sim, all game over states exist: impeachment, coup, assassination, bankruptcy (debt-to-GDP > threshold for 12 months) | 2 |
| S3.3-4 | As a player, I see a Security screen (threat levels, police, intelligence, agencies) | 1 |

**Tasks**
- [ ] Counter-terror operations: raid (risky), surveillance (slow), border sealing (economic cost)
- [ ] Coup risk formula: f(military loyalty, defence minister loyalty, approval)
- [ ] About 30 security and terror events (fictional groups, non-graphic writing)
- [ ] Difficulty affects event frequency and severity
- [ ] Balance run: the median passive bot loses by year 3; the balanced bot survives the term in ≥ 60% of seeds

**Demo (M3):** a flood hits the East; choose the relief response; a corruption scandal breaks; a terror plot is foiled thanks to intelligence funding; game over by impeachment when approval collapses.

---

## Phase 3 exit checklist
- [ ] ≥ 90 events in content, all schema-valid
- [ ] Sensitivity review of all event text (checklist in the master plan §1.3)
- [ ] M3 demo recorded

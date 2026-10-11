# Phase 2: Economy & Governance (32 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 1](phase_1_foundations.md) · [Phase 3 →](phase_3_domestic_security.md)

**Phase goal:** the core nation-building loop. The player runs the economy, sets the budget, appoints the cabinet, picks an ideology and strategy, and is judged by approval.
**Parity features:** F2, F3, F4, F5, F6 · **Milestone:** **M2: Nation Builder**

---

## Sprint 2.1: Economy Model (8 SP)

**Goal:** a believable macro-economy that settles monthly.

| ID     | Story                                                                                                | SP  |
| ------ | ---------------------------------------------------------------------------------------------------- | --- |
| S2.1-1 | As the sim, I model 5 sectors (Agriculture, Industry, Services, Energy, Tech) with output and growth | 3   |
| S2.1-2 | As the sim, I compute revenue (income tax, corporate tax, GST, customs) and expenditure              | 2   |
| S2.1-3 | As the sim, I track inflation, unemployment, debt, debt-to-GDP and interest                          | 2   |
| S2.1-4 | As a player, I see an Economy screen with key indicators and history charts                          | 1   |

**Tasks**

- [x] `systems/economy.ts`: monthly settlement; growth = f(investment, stability, corruption drag, tax burden, modifiers)
- [x] Starting values based on public macro data (GDP, sector shares, population), rounded and normalised
- [x] Borrowing when the treasury is below 0, with an interest rate that rises with debt-to-GDP
- [x] Monthly stat snapshots for charts (ring buffer, 10 years)
- [x] Unit tests: settlement maths, clamps, no NaN or Infinity after 50 years at extreme taxes

---

## Sprint 2.2: Budget & Taxation (8 SP)

**Goal:** the player controls money flows and sees the consequences.

| ID     | Story                                                                                      | SP  |
| ------ | ------------------------------------------------------------------------------------------ | --- |
| S2.2-1 | As a player, I set tax rates (income, corporate, GST, customs) with sliders                | 2   |
| S2.2-2 | As a player, I allocate budget across 11 ministries (as a percentage, or ₹ crore per year) | 3   |
| S2.2-3 | As a player, I see a projected monthly balance before confirming changes                   | 2   |
| S2.2-4 | As a player, I see "Why?" breakdowns for revenue, expenditure and growth                   | 1   |

**Tasks**

- [x] `content/ministries.json` and a zod schema
- [x] Commands: `SetTaxRate`, `SetMinistryBudget`; each validates bounds and change frequency
- [x] Ministry efficiency = funding ratio × minister competence (minister defaults until 2.3)
- [x] Budget screen with a stacked bar and a "projected vs current" comparison
- [x] Tooltip component wired to `modifiers.resolve()` breakdown

---

## Sprint 2.3: Cabinet & Ministers (8 SP)

**Goal:** people matter. Who runs each ministry changes outcomes.

| ID     | Story                                                                                             | SP  |
| ------ | ------------------------------------------------------------------------------------------------- | --- |
| S2.3-1 | As a player, I appoint and dismiss a minister for each of the 11 ministries from a candidate pool | 3   |
| S2.3-2 | As the sim, each minister has competence, loyalty, corruption, ideology affinity and salary       | 2   |
| S2.3-3 | As the sim, ministers generate monthly performance reports and occasional scandals                | 2   |
| S2.3-4 | As a player, I see a Cabinet screen with portraits (generated avatars) and stats                  | 1   |

**Tasks**

- [x] `content/ministers.json`: about 60 **fictional** candidates (name generator by region, avoiding real politicians)
- [x] Avatar: procedural SVG (no real likeness)
- [x] Effects: competence → ministry efficiency; corruption → budget leakage; loyalty → future coup risk input
- [x] Dismissal cost: an approval dip and a loyalty penalty for the rest of the cabinet
- [x] Candidate pool refreshes yearly

---

## Sprint 2.4: Ideology, Strategy, Approval & Balance Harness (8 SP)

**Goal:** close the loop. Choices produce approval, and approval decides your fate.

| ID     | Story                                                                                                                 | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------------- | --- |
| S2.4-1 | As a player, I choose an ideology (5) and a development strategy (5) with clear trade-offs                            | 2   |
| S2.4-2 | As the sim, approval (0–100) is computed from jobs, inflation, growth, corruption and HDI, and drifts toward a target | 2   |
| S2.4-3 | As the sim, approval < 15% for 3 months leads to impeachment (game over)                                              | 1   |
| S2.4-4 | As a developer, I can run `npm run balance` to simulate 50 seeds × 5 years × 3 bots and produce a CSV and summary     | 3   |

**Tasks**

- [x] `content/ideologies.json`, `content/strategies.json` (modifiers only, no hard-coded logic)
- [x] Changing ideology is allowed once per year, with an approval cost
- [x] Dashboard screen: approval gauge, top 3 issues, GDP growth, treasury trend
- [x] Game over screen with cause and stats summary
- [x] Bots: `passive` (no changes), `greedy` (max tax), `balanced` (heuristic)
- [x] Balance KPI bands written down here and asserted in a CI job (non-blocking at first)

**Demo (M2):** play 2 years. Cut taxes and see a deficit, debt and inflation follow; appoint a competent Finance minister and see growth improve; see approval react within a few months.

---

## Phase 2 exit checklist

- [x] M2 demo recorded: screenshots in [`docs/screenshots/phase-2/`](../../docs/screenshots/phase-2/); the flows are automated in `e2e/governance.spec.ts`
- [x] Balance report attached to the PR (no bot is bankrupt before year 2 on Normal)
- [x] Parity checklist F2–F6 ticked in the [master plan](../Master/master_plan.md)

---

## Balance KPI bands

`npm run balance` plays 50 seeds × 5 years × 3 bots and fails (exit 1) on Normal if any band is missed. CI runs it as a non-blocking job until Sprint 6.1.

| KPI                      | Band                                                     | Result at merge (Normal) |
| ------------------------ | -------------------------------------------------------- | ------------------------ |
| `no-early-bankruptcy`    | No bot has debt above 100% of GDP in years 1–2           | ✅ 0 runs                |
| `passive-survives`       | A passive President completes the term in ≥ 95% of seeds | ✅ 100%                  |
| `balanced-survives`      | The balanced bot completes the term in ≥ 95% of seeds    | ✅ 100%                  |
| `balanced-beats-passive` | Median final approval: balanced ≥ passive                | ✅ 67.0 vs 60.9          |
| `greedy-punished`        | Median final approval: greedy ≥ 5 points below passive   | ✅ 47.1 vs 60.9          |
| `no-runaway-approval`    | No run ends above 90% approval                           | ✅ max 71.0              |

**Bots:** `passive` never acts; `greedy` raises every tax as fast as the rules allow; `balanced` hires the best candidates each January and nudges taxes and spending toward a ~3% deficit.

---

## Delivery notes (2026-10-11)

### Definition of Done evidence

| DoD item                                     | Result                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `lint`, `typecheck`, `test` exit 0           | ✅ `npm run verify` green locally                                                                                       |
| New sim logic unit-tested; determinism green | ✅ 140 unit tests (100% line coverage on `src/sim`); determinism snapshot deliberately re-baselined for the new economy |
| UI works at 1920×1080 and 768 px             | ✅ 20 Playwright e2e tests (desktop + 768 px); also checked at 390 px                                                   |
| Content JSON schema-valid                    | ✅ `content/*.json` validated by zod at load; `tests/sim/content.test.ts`                                               |
| 50-year stress at extreme taxes              | ✅ no NaN/Infinity, all indicators within bounds (`tests/sim/economy.test.ts`)                                          |
| Old saves load                               | ✅ v1 → v2 migration; golden `v1.json` and new `v2.json` fixtures both load                                             |

### What changed in the model

- **Economy:** 5 sectors with trend growth plus nine drivers (policy, ministries, taxes, debt, corruption, inflation, stimulus, crowding out); inflation and unemployment drift to policy-driven targets; prices compound monthly. Calibrated to India today (GDP ≈ ₹330 lakh crore, debt ≈ 56% of GDP).
- **Fiscal:** four taxes with a Laffer curve, non-tax revenue, 11 ministries funded as a share of GDP, pensions, and interest. The treasury keeps half a month of spending; deficits are borrowed, large surpluses repay debt. The interest rate reprices slowly toward a market rate that rises with debt, inflation and big deficits (capped at 35%).
- **Approval:** seven voter factors (jobs, prices, growth, clean government, living standards, tax burden, public services) weighted into a target, plus modifiers. Three months below 15% means impeachment.

### Deviations from the plan

- **One `ENACT_BUDGET` command** (taxes and allocations together, with a preview) instead of separate `SetTaxRate`/`SetMinistryBudget`. Rules: one budget per 30 days, taxes move at most 5 points, allocations 25%–300% of standard.
- **Allocations are a share of GDP**, so budgets keep pace with growth and inflation without yearly re-entry.
- **Ministers are generated** from regional name lists in `content/names.json` (with a blocklist test for well-known politicians' names) rather than a fixed list of 60. A fresh pool of 3 per ministry arrives every January. Salaries were dropped as negligible.
- **Cabinet reports are quarterly**, not monthly, to keep the inbox readable at 4× speed.
- **"Industry & Commerce" became "Industry & Infrastructure"**, which also carries roads, rail and power spending.
- **Charts are a small in-house SVG component** (`src/ui/charts`) instead of Recharts: no new dependency, themed with the validated data-viz palette, with crosshair tooltips.

### Playtest log

- Cutting every tax 5 points: deficit doubles, inflation +1 point, debt falls more slowly; approval up ~3 points (popular, as tax cuts are).
- Cutting taxes to the legal minimum: inflation climbs past 15% within three years, the interest rate follows, growth slows and approval falls into the 40s.
- Hiring the best candidates each January: growth +0.8 points and approval +8 points after five years.
- Fixed during playtest: interest rate overflow over decades (now capped); tax sliders stopping half a step short of +5 points (floating-point bounds); charts offset by the browser's default `<figure>` margin; trait bars not rendering.

### Known issues → Phase 3 backlog

- Hard difficulty is still comfortable for a passive player (100% term completion). Phase 3's crises should add the missing pressure; re-check the bands then.
- Minister loyalty is tracked but has no effect until coup risk arrives in Sprint 3.3.
- Home, Defence, Disaster, Intelligence and External Affairs mainly affect public services and customs for now; their main roles arrive in Phases 3–5.

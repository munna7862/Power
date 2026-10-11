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

- [ ] `systems/economy.ts`: monthly settlement; growth = f(investment, stability, corruption drag, tax burden, modifiers)
- [ ] Starting values based on public macro data (GDP, sector shares, population), rounded and normalised
- [ ] Borrowing when the treasury is below 0, with an interest rate that rises with debt-to-GDP
- [ ] Monthly stat snapshots for charts (ring buffer, 10 years)
- [ ] Unit tests: settlement maths, clamps, no NaN or Infinity after 50 years at extreme taxes

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

- [ ] `content/ministries.json` and a zod schema
- [ ] Commands: `SetTaxRate`, `SetMinistryBudget`; each validates bounds and change frequency
- [ ] Ministry efficiency = funding ratio × minister competence (minister defaults until 2.3)
- [ ] Budget screen with a stacked bar and a "projected vs current" comparison
- [ ] Tooltip component wired to `modifiers.resolve()` breakdown

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

- [ ] `content/ministers.json`: about 60 **fictional** candidates (name generator by region, avoiding real politicians)
- [ ] Avatar: procedural SVG (no real likeness)
- [ ] Effects: competence → ministry efficiency; corruption → budget leakage; loyalty → future coup risk input
- [ ] Dismissal cost: an approval dip and a loyalty penalty for the rest of the cabinet
- [ ] Candidate pool refreshes yearly

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

- [ ] `content/ideologies.json`, `content/strategies.json` (modifiers only, no hard-coded logic)
- [ ] Changing ideology is allowed once per year, with an approval cost
- [ ] Dashboard screen: approval gauge, top 3 issues, GDP growth, treasury trend
- [ ] Game over screen with cause and stats summary
- [ ] Bots: `passive` (no changes), `greedy` (max tax), `balanced` (heuristic)
- [ ] Balance KPI bands written down here and asserted in a CI job (non-blocking at first)

**Demo (M2):** play 2 years. Cut taxes and see a deficit, debt and inflation follow; appoint a competent Finance minister and see growth improve; see approval react within a few months.

---

## Phase 2 exit checklist

- [ ] M2 demo recorded
- [ ] Balance report attached to the PR (no bot is bankrupt before year 2 on Normal)
- [ ] Parity checklist F2–F6 ticked in the [master plan](../Master/master_plan.md)

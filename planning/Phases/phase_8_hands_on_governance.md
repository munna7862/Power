# Phase 8: Hands-on Governance (redesign, about 66 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 7 backlog](phase_7_apex_mobile.md)

**Phase goal:** the President runs the country directly, the way the mobile "country simulator" genre plays, instead of through a cabinet of ministers. You build schools and hospitals in each region, keep the power grid ahead of demand, open factories and mines, staff the police, buy weapons from one armoury page, borrow when you must, and trade goods with other countries at the best price you can get.
**Milestone:** **M8: Hands-on President** · **Scheduled:** next, ahead of the Phase 7 backlog

As in Stage A, we borrow mechanics only. Names, text, layouts and art stay our own (master plan §1.3), and `tests/content/review.test.ts` keeps scanning new content for the reference game's name. The genre study behind this plan (the reference game's store screenshots and its sibling titles' listings) is summarised in §8.

---

## 1. Decisions (agreed 18 Oct 2026)

| Question                                | Decision                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Keep ideology and development strategy? | **Keep.** They still give their modifiers                                                                      |
| State plants only, or private too?      | **Both.** The player builds state plants and can license private ones; private plants also arrive on their own |
| Facilities per region or national?      | **Per region** (the six regions the sim already has)                                                           |
| Construction speed                      | **Fast, genre-style:** weeks for most buildings, a few months for the biggest (§3, Sprint 8.2)                 |
| v1.0 saves                              | **Fresh start.** Phase 8 does not migrate v1–v6 saves; it recognises them and explains (Sprint 8.9)            |
| Black-market weapons                    | **Left out**, for content tone                                                                                 |

---

## 2. What changes for the player

| Today (v1.0)                                                    | After Phase 8                                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cabinet:** appoint 11 ministers, manage loyalty and scandals  | **Removed.** Each ministry becomes a **department** with **star-rated services** that improve as you invest                                                                 |
| **Budget:** a share-of-GDP slider per ministry, settled monthly | Running costs per department, shown **per day** on a General Expenses page; construction, plants and weapons are bought outright on their own screens                       |
| HDI and "public services" come from ministry efficiency         | They come from **facility coverage** in each region: schools, colleges, hospitals, clinics and so on                                                                        |
| Sector growth comes from formulas                               | **Industry:** state and licensed private factories, mines and farms produce goods; output feeds the sectors and creates jobs                                                |
| No energy model                                                 | **Power grid:** plants produce, the economy consumes; a shortfall throttles industry                                                                                        |
| Trade: abstract contracts that add growth and customs           | **Trade market:** real goods with world prices; sell surplus, buy shortages from the best-priced partner; tariffs, quotas and bans                                          |
| Military: procurement fund, production queue, research          | **Armoury:** one page to buy every unit type with treasury money; research and drills stay                                                                                  |
| Police: the Home ministry's allocation plus three operations    | **Police & internal affairs:** officers, stations, equipment, special units, intelligence and anti-corruption agencies, managed directly                                    |
| Debt is borrowed automatically                                  | **Loans:** take loans from friendly countries (embassy needed) or an international lender, each with a rate and due date; automatic borrowing stays as a costly last resort |
| "Why?" tooltips only                                            | Plus an **advisor** who flags the most urgent problem and opens the right screen                                                                                            |

### Screens

- **Removed:** Cabinet.
- **New:** Departments (star ratings), Construction, Energy, Industry, Trade Market, Armoury (replaces the Forces tab), Police & Internal Affairs (absorbs Security's operations and inquiries), Finance (General Expenses and Loans).
- **Kept:** Dashboard, Inbox, Economy, Budget, Military (Ops, War and Nuclear tabs), World, Diplomacy, Reports.
- **Top bar:** treasury with its daily change (`₹2,10,000 cr (+₹1,200 cr/day)`), approval, population, date and speed.

---

## 3. Design principles

1. **Every new effect is a modifier or a shared formula.** Coverage, star ratings, power, factory output and trade flows feed the modifier stack or the shared formulas (`growth.ts`, `approval.ts`, `unrest.ts`), so "Why?" keeps explaining every number.
2. **The sim stays pure and deterministic.** World prices and private investment move through the seeded `Rng`; building, trading and borrowing are commands through `dispatch()`.
3. **Counts, not sliders, for things you build.** Facilities and plants are whole numbers with a cost, a build time and upkeep.
4. **Money reads per day, settles monthly.** The UI shows daily rates; `projectMonth` and the monthly settlement stay the source of truth, so the two can't disagree.
5. **The QA lessons hold.** No multiplier derived from a rate the player can change later (DEF-01). Revenue and prices are floored at 0 (DEF-10). Every purchase checks the treasury (DEF-08).
6. **Balance is re-run, and bands are re-set deliberately**, with 200 seeds for the headline re-election bands.

---

## 4. Sprints

### Sprint 8.1: Departments replace the cabinet (8 SP) ✅

| ID     | Story                                                                                                                            | SP  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | --- |
| S8.1-1 | As a player, I no longer appoint ministers; each department has services rated 1–5 stars that rise when I invest in them         | 3   |
| S8.1-2 | As the sim, department efficiency = funding × service stars × facility coverage × national corruption (no minister)              | 2   |
| S8.1-3 | As the sim, coup risk, presidential safety and corruption use armed-forces pay, morale and agency strength, not minister loyalty | 2   |
| S8.1-4 | As a player, corruption inquiries audit a department instead of a minister                                                       | 1   |

**Tasks**

- [x] `content/departments.json`: each department's services (for Disaster Response: search and rescue, engineering, hazardous materials, fire service…), an upgrade cost per star and the effect each star gives. Our own names and wording throughout
- [x] State: `departments: Record<MinistryId, { services: Record<ServiceId, 1 | 2 | 3 | 4 | 5> }>`; command `UPGRADE_SERVICE { department, service }` (treasury-checked, takes a few weeks)
- [x] Stars decay by one if a department stays badly underfunded for six months, so running costs still matter
- [x] Remove `cabinet` from `GameState`, along with `cabinet/generate.ts`, `cabinet/scandal.ts`, `commands/cabinet.ts`, `systems/cabinet.ts` (`cabinetSystem`, `candidateRefreshSystem`), `CabinetView.tsx`, `i18n/en/cabinet.json` and the Cabinet nav entry and F-key
- [x] `coupRisk`, `militaryLoyaltyTarget`, `presidentialSafety` and the corruption target: replace minister terms with Defence pay, morale, Presidential Protection and Anti-Corruption agency strength
- [x] Inquiries become `{ department }` audits; a finding cuts that department's leakage for a year
- [x] Events: rewrite the 21 `loyalty` effects, the 3 `scandal` effects, and the `minLoyalty` / `maxMinisterCorruption` / `vacancies` conditions; drop those effect types and stats from the zod schema
- [x] Tutorial and handbook: replace the cabinet steps and chapter
- [x] Pulled forward from 8.9, because removing the cabinet changes the save shape: `SCHEMA_VERSION` 7, v1–v6 saves refused with an explanation, golden fixture `v7.json`, AGENTS.md save rule updated
- [x] Balance re-run with no band changes needed (balanced bot re-elected 98% Easy, 80% Normal, 24% Hard); the cabinet-only event (`cabinet-rumours`) removed, `minister-scandal` became `officials-scandal` and `defence-minister-rift` became `army-command-rift`

---

### Sprint 8.2: Public works and construction (8 SP) ✅

| ID     | Story                                                                                                               | SP  |
| ------ | ------------------------------------------------------------------------------------------------------------------- | --- |
| S8.2-1 | As a player, I build schools, colleges, hospitals, clinics, roads and water works in a chosen region                | 3   |
| S8.2-2 | As the sim, each facility has upkeep and capacity; coverage = capacity ÷ need (the region's population)             | 2   |
| S8.2-3 | As the sim, regional coverage drives HDI, the "public services" approval factor, regional unrest and growth         | 2   |
| S8.2-4 | As a player, the Construction screen shows counts and coverage gaps per region, the build queue and "Why?" for each | 1   |

**Tasks**

- [x] `content/facilities.json` (zod-validated in `src/sim/content/infrastructure.ts`): `id`, `department`, `area`, `cost`, `buildDays`, `upkeep`, `capacity`, `jobs` and each region's `opening` share; the 10 listed types across seven coverage areas (schools, universities, clinics, hospitals, water, housing, transport). What each area feeds (`effects`) lives in `AREA_WEIGHTS` (`infrastructure/constants.ts`), so one formula serves the sim and the "Why?" tooltips
- [x] **Fast builds:** small buildings take 2–4 weeks, large ones 1–3 months, in-game time
- [x] State: `infrastructure: { counts: Record<RegionId, Record<FacilityId, number>>; queue: BuildOrder[] }`; `SCHEMA_VERSION` 8 with a v7 → v8 migration (a game in progress gets the opening network) and golden fixture `v8.json`
- [x] Commands: `BUILD_FACILITY { facility, region, quantity }` (treasury-checked), `CANCEL_BUILD` (50% refund), `DEMOLISH_FACILITY`
- [x] Upkeep is a per-department expenditure line in `projectMonth`: each department pays the running costs of facilities built beyond the opening network (whose costs its allocation already covers); demolishing below it saves money
- [x] Opening counts come from each region's opening coverage, and every coverage effect is measured against the opening network, so the v1.0 starting HDI, services score, unrest and growth are exactly unchanged at tick 0. After that the growing population wears coverage down unless the President builds
- [x] Regional coverage adds a "Schools, clinics and housing" driver to `unrestTarget`; national coverage adds to the HDI target, the "public services" approval factor and a "Roads, rail and universities" growth driver; new facilities' staff cut unemployment
- [x] Construction screen: coverage of every area in every region, a build panel per region with "Why?" per area, the project queue (cancel with refund) and the running costs added per department. F1–F10 keep their screens; new screens are reached from the navigation bar
- [x] Balance: the balanced bot builds toward 95% coverage where it buys the most per rupee (pulled forward from 8.9). All bands pass unchanged: balanced re-election 98% Easy, 84% Normal, 38% Hard

### Sprint 8.3: Police and internal affairs (8 SP) ✅

| ID     | Story                                                                                                                        | SP  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | --- |
| S8.3-1 | As a player, I set police strength per region, build stations, buy equipment and raise special units                         | 3   |
| S8.3-2 | As the sim, police per 100,000 people sets crime and unrest suppression; over-policing costs approval (civil liberties)      | 2   |
| S8.3-3 | As a player, I fund and grow the intelligence service, the anti-corruption bureau, border police and presidential protection | 2   |
| S8.3-4 | As a player, operations (raid, surveillance, border seal) and audits live on this screen                                     | 1   |

**Tasks**

- [x] `content/police.json` (zod-validated in `src/sim/content/police.ts`): officers (recruit cost, pay, 150 per 1,00,000 at the start), stations (cost, capacity), three equipment tiers, four units (armed police, rapid response, cyber cell, counter-terror squad) and four agencies (intelligence service, anti-corruption bureau, border police, presidential protection), each paid by a department
- [x] State: `police: { officers; stations; equipment; units; agencies }` as planned, plus `security.crime` per region; `SCHEMA_VERSION` 9 with a v8 → v9 migration (opening force, starting crime) and golden fixture `v9.json`
- [x] Commands: `RECRUIT_POLICE` (negative dismisses), `BUILD_STATION`, `UPGRADE_POLICE_EQUIPMENT`, `RAISE_UNIT` (negative disbands), `FUND_AGENCY`; growing the force is paid up front, cuts are free and save upkeep, charged per department in `projectMonth` beyond the opening force
- [x] A regional `crime` stat (monthly `crime` system before unrest) driven by jobs, corruption, officers, armed police and cyber cells, on the Security tile map (Unrest / Crime toggle) with "Why?"; crime feeds unrest and "safety and order". `unrestTarget`, `terrorTarget`, `intelligenceFoilChance`, `plotSuccessChance`, `presidentialSafety`, the corruption target and audit odds read police and agency strength. Officers beyond station capacity work at half strength
- [x] A "civil liberties" approval line in `approvalTarget`'s breakdown: police benefits grow with the log of the force, while the cost grows as (ratio − 1)^1.5, so maximum policing is never free; equipment does not count
- [x] Every police effect is measured against the opening force, so tick 0 is unchanged; a growing population thins the police unless the President recruits
- [x] Police & Internal Affairs screen (nav after Security): police by region with recruit, dismiss, "to 100%" and stations, equipment, special units, agencies, civil liberties with "Why?", running costs; the counter-terror operations and audits moved here from Security
- [x] Balance: the balanced bot keeps each region's police at its opening strength and adds counter-terror squads when the threat is high. All bands pass unchanged: balanced re-election 96% Easy, 86% Normal, 34% Hard

### Sprint 8.4: Energy and the power grid (5 SP) ✅

| ID     | Story                                                                                                                    | SP  |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | --- |
| S8.4-1 | As a player, I build solar, wind, thermal (coal), gas, hydro and nuclear plants, each with its own cost, time and output | 2   |
| S8.4-2 | As the sim, homes, facilities and industry consume power; production vs consumption is shown on the Energy screen        | 2   |
| S8.4-3 | As the sim, a shortfall throttles industry and costs approval; a surplus can be exported                                 | 1   |

**Tasks**

- [x] `content/power.json` (zod-validated in `src/sim/content/power.ts`): six plant types (solar, wind, coal, gas, hydro, nuclear) with cost, build time (solar 3 weeks to nuclear a year), capacity and capacity factor, upkeep, fuel and fuel cost, emissions and the opening fleet per region (about 183 GW on average, 69% coal)
- [x] State: `energy: { plants: Record<RegionId, Record<PlantId, number>>; queue: PlantOrder[] }`; derived `production`, `consumption` (homes, industry, services, public facilities, each following its driver) and `powerBalance` in `src/sim/energy/grid.ts`. `SCHEMA_VERSION` 10 with a v9 → v10 migration and golden fixture `v10.json`
- [x] Commands `BUILD_PLANT` (treasury-checked), `CANCEL_PLANT` (50% refund), `DECOMMISSION_PLANT`; plants connect in the daily `energy-daily` system; running and fuel costs beyond the opening fleet are charged to Industry & Infrastructure in `projectMonth`
- [x] Thermal and gas plants burn fuel from stock (done in Sprint 8.5): `fuelUse` in `content/power.json` is drawn from the coal, gas and uranium stocks each month, and a station short of fuel generates less
- [x] A shortfall (share of demand unmet) costs every sector growth (a "Power cuts" growth driver) and approval; production beyond demand and a 5% reserve is exported, earning non-tax revenue
- [x] Emissions against the opening grid add an "Air pollution" line to the approval target (a cleaner grid earns approval back) and make disaster events likelier. Implemented as an approval-target line rather than a new approval factor, so the satisfaction weights and saves stay unchanged
- [x] The grid opens with a 5% reserve margin, so tick 0 is unchanged; demand grows about 5.6 GW a year and a hands-off grid is short in its second year
- [x] Energy screen (nav after Construction): production, demand, balance and emissions; demand by source with "Why?", production by plant type, what the grid does now, power projects and a build panel per region
- [x] Balance: the balanced bot keeps a 6% margin with solar parks. All bands pass unchanged: balanced re-election 96% Easy, 78% Normal, 38% Hard

### Sprint 8.5: Industry and production (8 SP) ✅

| ID     | Story                                                                                                                                 | SP  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | --- |
| S8.5-1 | As a player, I build state factories: steel, textiles, electronics, pharmaceuticals, vehicles, refineries, food processing, chemicals | 3   |
| S8.5-2 | As a player, I open mines, oil fields and farm projects that produce raw goods (coal, iron ore, crude oil, grain, cotton…)            | 2   |
| S8.5-3 | As a player, I license private plants for a fee; private investors also build on their own when the business climate is good          | 2   |
| S8.5-4 | As a player, the Industry screen shows each plant's output, inputs, profit and jobs, with "Why?" for each                             | 1   |

**Tasks**

- [x] `content/goods.json` (15 goods: base world price, unit, sector, world market size, opening imports) and `content/industries.json` (18 plant types: inputs and outputs per month, power need, jobs, cost, build time, upkeep, sector, licence fee and opening state and private plants per region), 24 plant types with energy; production runs in content order, which the loader checks
- [x] State: `industry: { plants; stocks; queue; last; applied }` (`last` is the last monthly settlement, `applied` the value added already folded into sector output); `SCHEMA_VERSION` 11 with a v10 → v11 migration and golden fixture `v11.json` (one version for 8.5 and 8.6)
- [x] A monthly `industry-monthly` system after economy and before fiscal settles `computeFlows()`: plants draw inputs and power and produce goods, power stations burn fuel, the country buys what it needs and the private market imports what stocks lack. State plants' profit goes to the treasury (non-tax revenue) and private plants pay corporate tax, both against the opening settlement; a shortage of inputs or power throttles output, shown per plant as "running at N%"
- [x] `LICENSE_PLANT { industry, region }`: a fee to the treasury, a private plant after 45 days; an investor must want it (a profitable plant, a climate of at least 95%) and at most two are built at once. State plants: `BUILD_INDUSTRY`, `CANCEL_INDUSTRY`, `CLOSE_INDUSTRY`
- [x] Private investment follows the business climate (corporate tax, power cuts, corruption, unrest; 1 at the start, with a "Why?"): investors open plants above 105% and close them below 95%, drawing two random numbers per industry each month
- [x] Sector growth gains a "Factories, mines and farms" driver in `growth.ts`: a change in plants' real value added shifts the sector's output once; the old trend formulas remain the part of the economy plants don't model. New plants' jobs cut unemployment and their power need adds to grid demand

### Sprint 8.6: Trade market, exports and imports (8 SP) ✅

| ID     | Story                                                                                                           | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------- | --- |
| S8.6-1 | As a player, I see world prices for every good and the price each partner offers to buy or sell                 | 3   |
| S8.6-2 | As a player, I sell surplus and buy shortages, picking the best-priced partner; one button sells all surplus    | 2   |
| S8.6-3 | As a player, I set export and import controls per good: tariff %, quota or ban                                  | 2   |
| S8.6-4 | As the sim, prices drift with world events and supply; relations, embassies and sanctions decide who will trade | 1   |

**Tasks**

- [x] State: `market: { prices; controls; volumes }` as planned, plus each partner's traded volume this month
- [x] Partner price = world price × (1 ± a spread from relation, distance, partner strengths and India's reputation), from `market/pricing.ts`, shared by the trades, the "Why?" and the bots. The focus nations trade; a partner needs relations above −20, no sanctions or war, and an embassy or relations of 20
- [x] Commands: `SELL_GOODS { good, partner, quantity }`, `BUY_GOODS`, `SELL_ALL_SURPLUS` (each good to its best buyers), `SELL_ON_WORLD_MARKET` (any quantity, at 85% of the world price), `SET_TRADE_CONTROL`. Only the surplus (stock above the private market's target) can be sold, or selling would just make the market import it again
- [x] Standing contracts (`SIGN_SUPPLY_CONTRACT`) reuse `signTreaty()` (type `trade`, terms: good, side, monthly quantity, price) and deliver monthly; shown as a table on the Trade Market screen and described on the Diplomacy and Country screens. They do not count toward the sector-contract limit
- [x] Tariffs per good (10% at the start): customs revenue gains Σ imports × price × tariff against the opening settlement; the customs slider leaves the Budget screen (the general rate stays at its default for goods the model does not cover)
- [x] Goods-market inflation drivers (import dependence, shortages, tariffs), measured against the start; `fuel-shortage` and `food-shortage` events on the new `fuelShortage` and `foodShortage` stats
- [x] Prices move after each trade, drift back to base monthly with some noise, and each partner has monthly capacity, so there's no buy-low, sell-high loop in one tick

### Sprint 8.7: Armoury, one page to buy the military (5 SP) ✅

| ID     | Story                                                                                                          | SP  |
| ------ | -------------------------------------------------------------------------------------------------------------- | --- |
| S8.7-1 | As a player, one Armoury page shows every unit type as a card: attack, defence, price, upkeep, owned, delivery | 2   |
| S8.7-2 | As a player, I buy any quantity with treasury money and see India's strength change before I confirm           | 2   |
| S8.7-3 | As a player, I can decommission units to save upkeep, and upgrade a type when research unlocks a tier          | 1   |

**Tasks**

- [x] Purchases come from the treasury; the procurement fund and its cap go away
- [x] Short delivery times (days to a few weeks) so wars still can't be won by buying on the day
- [x] Defence funding becomes pay and upkeep only; research and drills stay on the Military screen, paid from the treasury
- [x] The preview uses `militaryStrength()` on the hypothetical force, so the number shown is the number the sim uses
- [x] Generic class names only (AGENTS.md); no black-market tab

### Sprint 8.8: Daily money, loans and the advisor (5 SP) ✅

| ID     | Story                                                                                                                 | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------------- | --- |
| S8.8-1 | As a player, the top bar shows the treasury's daily change, and General Expenses lists each department's cost per day | 1   |
| S8.8-2 | As a player, I take loans from friendly countries (embassy needed) or an international lender, and repay them early   | 2   |
| S8.8-3 | As a player, an advisor flags the most urgent problem ("police are underfunded in the East") and opens that screen    | 2   |

**Tasks**

- [x] Daily figures are `projectMonth` ÷ days in the month, so the UI and the settlement agree
- [x] State: `loans: { id; lender: CountryId | 'intl'; principal; rate; dueTick }[]`; commands `TAKE_LOAN`, `REPAY_LOAN`; a lender's rate depends on relation, India's debt-to-GDP and reputation
- [x] A missed repayment costs reputation and the lender's goodwill; automatic borrowing stays, at a worse rate, as the last resort
- [x] The advisor ranks warnings from the existing "Why?" drivers (the worst-scoring approval factor, an unfunded department, a power shortfall, a stock running out); text lives in i18n

### Sprint 8.9: Fresh start, balance and polish (6 SP) ✅

| ID     | Story                                                                                                   | SP  |
| ------ | ------------------------------------------------------------------------------------------------------- | --- |
| S8.9-1 | As a player with a v1.0 save, I'm told it comes from the previous edition and can't be continued        | 1   |
| S8.9-2 | As a developer, the balance bots play the new screens and every KPI band passes, with changes justified | 3   |
| S8.9-3 | As a player, the tutorial and the handbook teach the new screens                                        | 2   |

**Tasks**

- [x] **Fresh start (decision 5, done in Sprint 8.1):** `SCHEMA_VERSION` 7 starts a new save line; `parseSave` recognises v1–v6 files and returns a clear "saved in the previous edition" message instead of loading them. The v1–v6 golden fixtures stay, as tests of that message
- [x] Update AGENTS.md: the "old saves must keep loading" rule now applies from v7 onwards, with this phase noted as the one deliberate break
- [x] Bots: the passive bot builds nothing; the greedy bot over-taxes and under-builds; the balanced bot builds to coverage targets, keeps the grid positive, runs profitable industry, trades surplus and repays loans
- [x] New KPI bands: coverage, power balance, trade balance, industry profit, police per capita, loan burden; re-tune Easy, Normal and Hard in `difficulty.ts`
- [x] Determinism golden hashes (Windows and Linux) refreshed deliberately
- [x] Playwright: one spec per new screen (build a school, add a solar park, open a steel plant, sell all surplus, buy tanks, recruit police, take and repay a loan)
- [x] Update the master plan (§5.3 governance no longer has ministers)

**Balance at the end of the phase.** Hands-on play made the game easier: the balanced bot, now running industry,
trade and loans as well, won re-election on Normal in 100% of seeds, above the 50–90% band. Rather than move the
band, Normal and Hard were re-tuned in `difficulty.ts`: voter fatigue 5 → 6 points a year and the re-election bar
55% → 58% (Easy unchanged). The new bands below cover the balanced bot's completed terms on Normal (50 seeds × 5 years).

| KPI                 | Band                                                                                     | Result at merge                   |
| ------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| `coverage-grows`    | Mean coverage ends at least 1 point above the opening network, and above the passive bot | ✅ 68.7% vs 67.0% (passive 65.8%) |
| `grid-positive`     | No balanced term ends with a power shortfall                                             | ✅ 0 runs; margin 5.4%            |
| `trade-balance`     | The goods import bill ends no larger a share of GDP than at the start                    | ✅ 2.9% vs 4.5%                   |
| `industry-profit`   | State plants' monthly profit ends at or above the opening                                | ✅ ₹51,347 vs ₹25,978 crore       |
| `police-per-capita` | Every region keeps ≥ 95% of the opening police per head in ≥ 90% of terms                | ✅ 100%                           |
| `loan-burden`       | Terms end owing ≤ 1% of GDP in loans, with no missed repayment                           | ✅ 0 runs, 0 missed               |

All earlier bands still hold. Balanced re-election: Easy 100%, Normal 76%, Hard 36%.

### Sprint 8.10: National play option (5 SP) ✅

A New Game option, **Regional play**. On, the game plays exactly as it does now. Off, the President runs one India:
no region pickers, no tile map, national figures everywhere. The simulation is the same in both modes: it keeps its
six regions underneath, and with regions off the President's orders are spread across them automatically, **worst
region first**. One simulation means one save shape, one set of formulas and "Why?" tooltips that cannot drift
between the modes; the cost is one extra code path (the split) that every regional command has to go through.

| ID      | Story                                                                                                              | SP  |
| ------- | ------------------------------------------------------------------------------------------------------------------ | --- |
| S8.10-1 | As a player, I choose Regional play on or off on the New Game screen; on plays exactly as before                   | 1   |
| S8.10-2 | As the sim, an order with no region is split across regions, worst first, by one pure function the UI previews too | 2   |
| S8.10-3 | As a player with regions off, every screen, event, advisor tip and "Why?" speaks of India, never of a region       | 1   |
| S8.10-4 | As a developer, the bots play both modes and a national-play probe and band keep the two modes comparable          | 1   |

**Decisions**

| Question                                     | Decision                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Separate national formulas?                  | **No.** The six regions stay in the state; national play is a way of giving orders and of showing results  |
| How orders are split                         | **Worst region first** (water-filling), ties broken in `REGIONS` order, so it is deterministic             |
| Default                                      | **On** in `DEFAULT_OPTIONS`, so tests, bots and the determinism hashes are unchanged; the toggle starts on |
| Which unrest figure the national gauge shows | **The highest region's**, because that is where riots fire; "Why?" lists its drivers without naming it     |
| Crime, coverage, police per 100k             | Population-weighted national averages                                                                      |

**Tasks**

- [x] State: `meta.options.regions: boolean` in `GameOptions` and `DEFAULT_OPTIONS` (`true`); a facility order's `region` may be `null` (an order for all of India); `SCHEMA_VERSION` 13 with a v12 → v13 migration that sets `regions: true`, `src/sim/save/schema.ts` updated, golden fixture `v13.json` (national play, with region-free clinic and police orders)
- [x] `src/sim/national/split.ts` (pure, exported from `src/sim/index.ts`): `fillLowest()` spreads whole units over the regions, lowest level first, weighted by how far one unit moves each region, never past a cap; ties go in `REGIONS` order. On top of it:
  - `splitFacilities` / `splitDemolish`: lowest (highest) coverage of the facility's area (`coverage()`)
  - `splitOfficers`: recruits where officers per head against the opening force are lowest, dismissals where highest; `splitStations`: where the most officers have no station
  - `splitDecommission` / `splitCloseIndustry`: where there are most plants of that kind
  - `homeRegion()`: power plants and state factories do not depend on their region (the grid and the goods market are national), so national orders go to the most populous region
- [x] Commands: `region` is optional on `BUILD_FACILITY`, `DEMOLISH_FACILITY`, `BUILD_PLANT`, `DECOMMISSION_PLANT`, `BUILD_INDUSTRY`, `LICENSE_PLANT`, `CLOSE_INDUSTRY`, `RECRUIT_POLICE` and `BUILD_STATION`, in both modes. **Changed from the plan:** a national facility order is queued once, with `region: null`, and split when it opens, so it takes one queue slot, writes one inbox entry and lands where the gaps are on the day it opens. Immediate orders (police, stations, closures) split at once and write one entry
- [x] Read helpers in `src/sim/national/view.ts`: `nationalUnrest()` (the hottest region), `nationalCrime()` and `nationalCrimeTarget()` (population-weighted, drivers averaged), `nationalPoliceRatio()`, `nationalHeadcountRatio()`, and national officer and station counts and needs. `coverage()`, `explainCoverage()` and `facilitiesForTarget()` take `null` for India
- [x] Inbox and events: every log line names its place through `placeName()` ("the North", or "India" in national play); `fillText()` writes "the affected area" for `the {region}` / `The {region}` in national play, and regional events still pick a region underneath, so the odds and outcomes are those of regional play. The cyclone text was reworded to read well both ways
- [x] Advisor: `advise()` keeps the region; `adviceText()` uses region-free wordings of the coverage, police and unrest topics in national play
- [x] UI: the **Regional play** toggle on the New Game screen; with it off, Construction, Police, Energy and Industry hide their region pickers and show national rows, Security shows India's unrest and crime with their "Why?" in place of the map, and terror plots and the war annexation note name no region. Text in i18n only (`regions.india`, `regions.inSentence`)
- [x] Bots: the balanced bot gives region-free orders in national play; the passive and greedy bots are unchanged
- [x] Balance: a national-play probe in `tools/balance/release.ts` (balanced bot, Normal, regions off, the same seeds as the regional runs) and two bands, `national-play-comparable` and `national-play-governed` (below)
- [x] Tests: `tests/sim/national.test.ts` (worst first, deterministic, caps, weights, every region-free command, national text, national figures, the v12 → v13 migration); the determinism golden hash moves only through `meta` and `schemaVersion`, and a regional bot game writes exactly the same inbox as before; Playwright: a national game builds clinics with no region and shows India on the Police and Security screens
- [x] Docs: the handbook's Game options entry explains both modes; AGENTS.md has a National play section

**Balance at the end of the sprint.** Regional play is unchanged: every earlier band holds with the same results as Sprint 8.9 (balanced re-election 100% Easy, 76% Normal, 36% Hard). National play is a little easier, because worst-region-first placement spends each rupee where coverage and policing are thinnest. That is within the band, and no rule was re-tuned for it.

| KPI                        | Band                                                                                                             | Result at merge                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `national-play-comparable` | With Regional play off, balanced re-election on Normal is within 10 points of regional play (50 seeds × 5 years) | ✅ 84% vs 76%                                    |
| `national-play-governed`   | Every region keeps ≥ 95% of the opening police per head in ≥ 90% of terms; coverage ends ≥ 1 point above opening | ✅ police 100% of terms; coverage 77.0% vs 67.0% |

---

## 5. How the pieces connect

```
Departments (stars, funding) ──► department efficiency ──► everything below
Construction ──coverage by region──► HDI, public services, unrest, growth
Police & agencies ─────────────────► crime, unrest, terror, corruption, presidential safety
Energy ──power balance─────────────► industry throughput, approval, emissions
Industry ──goods, jobs, profit─────► sector output, unemployment, stocks, treasury
Stocks ⇄ Trade market ─────────────► treasury, tariffs, inflation, relations
Armoury ───────────────────────────► forces → strength, deterrence, war
Loans ─────────────────────────────► treasury now, interest and repayments later
Advisor ◄── the worst "Why?" drivers
```

Running costs (upkeep, salaries, interest) settle monthly in `projectMonth` and show per day. One-off purchases (buildings, plants, star upgrades, weapons, licences) come straight out of the treasury and are refused when it can't cover them.

---

## 6. Order of work

1. **8.1 first:** removing the cabinet touches the most code; neutral 1.0 terms keep the game playable until the later sprints feed real values in.
2. **8.2 and 8.3** can run in parallel once 8.1 lands (different files).
3. **8.4 before 8.5:** industry needs power.
4. **8.6 after 8.5:** trade needs goods.
5. **8.7 and 8.8** are independent and can slot in anywhere after 8.1.
6. **8.9 last** of the redesign.
7. **8.10** (national play) after 8.9: it builds on every regional screen and on the balanced bot.

---

## 7. Risks

| Risk                                                            | Mitigation                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Removing the cabinet touches about 40 files, events and balance | Sprint 8.1 first, behind neutral 1.0 terms, so the game stays playable at every step                         |
| Too much micro-management for a casual player                   | "Auto-build to target coverage" per department, "sell all surplus", and the advisor pointing at what matters |
| Economy exploits                                                | Prices move after each trade; monthly capacity per partner; balance probes for arbitrage and loan cycling    |
| Fast builds make the game too easy                              | Upkeep and power demand scale with what you build; coverage has diminishing returns                          |
| Players lose v1.0 saves (decision 5)                            | A clear in-game notice; release notes say so; v1.0 stays downloadable                                        |
| Sliding toward copying the reference game                       | Own names, layout and text; a review checklist item; the content review test stays blocking                  |

---

## 8. Genre study (what the reference game does)

From the reference game's store screenshots and its developer's sibling titles (the same engine):

- **Top bar:** money with its daily change, approval, population, date and speed; a scrolling news ticker.
- **Departments:** a row of department icons; each department has management (services rated with stars), construction and staff tabs.
- **Spending:** a general-expenses list of each department's cost per day, with warnings when one is underfunded.
- **Energy:** power plant types with very different build times and outputs, and production vs consumption.
- **Industry:** more than 50 plant types, including factories and mines.
- **Trade:** per-good contracts (amount, profit, period, partner), "sell on the world market" and "sell all surplus".
- **Military:** one shop of unit cards (attack, defence, upkeep, price, owned, delivery time), plus a black-market tab.
- **Loans:** foreign loans (embassy needed) and an international lender, each with a rate and due date.
- **Advisor:** pop-up warnings with a button to the relevant department.
- **Also:** ideology and development strategy, ministers, a world map.

What we take: the hands-on loop (build, produce, trade, buy), stars for departments, daily money, loans, the advisor. What we leave: ministers (by request), the black market, and all of its names, art, text and layout.

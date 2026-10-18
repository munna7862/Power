NaN ✅ |NaN ✅ |NaN ✅ |NaN ✅ |NaN ✅ |NaN ✅ |# India: Apex Sovereign — Master Plan

> **Code name:** `Power` · **Genre:** Realistic political & national strategy simulation · **Platforms:** PC first (Windows/macOS/Linux), then Android & iOS
>
> [Planning index](../README.md) · [Phase 1 →](../Phases/phase_1_foundations.md)

---

## 1. Vision

You are the President of India. Every rupee, school, power plant, crisis, treaty and soldier is your decision.
_India: Apex Sovereign_ starts as a **feature-complete re-imagining of the mobile "country simulator" genre** (reference: _India Simulator 2_ by Oxiwyle). It is rebuilt for PC with deeper systems, a modern UI, no ads and no pay-to-win. Then it grows beyond the genre.

### 1.1 Two-stage strategy

| Stage               | Goal                                                                                                | Phases     |
| ------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| **Stage A: Parity** | Match the public feature set of the reference game, with our own UI, formulas, content and identity | Phases 1–6 |
| **Stage B: Apex**   | Go beyond it: deeper economy, Parliament and states, cause-and-effect events, mobile release        | Phase 7+   |

### 1.2 Design pillars

1. **Decisions have visible consequences.** Every number on screen can be traced to its causes in the "Why?" tooltips.
2. **Realistic, not punishing.** The game is grounded in real Indian governance, but readable for a casual player.
3. **Fair play.** It is a one-time purchase with no ads and no paid shortcuts. Everything is unlocked by playing.
4. **One simulation, every platform.** A pure TypeScript simulation core runs the same on PC and mobile.
5. **Tested like production software.** The simulation is deterministic, unit-tested, and balanced by headless bot runs.

### 1.3 Legal & content guardrails (non-negotiable)

- **Original identity.** Never copy the reference game's name, art, icons, text, UI layouts or sounds. Game mechanics are not copyrightable; expression is.
- **Official boundaries.** Maps must show India's boundaries as per the Survey of India (Jammu & Kashmir, Ladakh, Arunachal Pradesh). For world data, use the **Natural Earth "India point-of-view"** admin-0 dataset.
- **Fictional people.** Ministers, rival leaders, political figures and terror/insurgent groups are fictional. No real politicians or real political parties.
- **Real nations, neutral tone.** Real countries appear with neutral, stats-based AI. Nothing should read as propaganda about a real nation or community. Domestic unrest is modelled by **state or region and cause** (economic, regional, law and order), never by religion or caste.
- **Weapons.** Use generic class names ("Main Battle Tank Mk II"), not trademarked product names.

---

## 2. Scope

### 2.1 Feature parity checklist (Stage A)

Derived from the reference game's public store listing. We design all internals ourselves.

| #   | Reference feature                            | Our system                                                       | Phase    |
| --- | -------------------------------------------- | ---------------------------------------------------------------- | -------- |
| F1  | Rule as President, with daily tasks          | Game clock, turn engine, inbox and decisions                     | 1 ✅     |
| F2  | Control government institutions              | Ministries and budget allocation                                 | 2 ✅     |
| F3  | Appoint ministers of key ministries          | Cabinet system with candidate traits (departments since Phase 8) | 2 ✅     |
| F4  | Ideology & development strategy              | Ideology plus strategy modifiers                                 | 2 ✅     |
| F5  | Build a prosperous nation / living standards | Economy, sectors, Human Development Index (HDI)                  | 2 ✅     |
| F6  | Rating / approval                            | Approval model with drift and shocks                             | 2 ✅     |
| F7  | Handle emergencies                           | Disaster events (flood, cyclone, quake, epidemic)                | 3 ✅     |
| F8  | Fight corruption                             | Corruption index, anti-corruption agency, investigations         | 3 ✅     |
| F9  | Riots / unrest                               | Unrest per region, police response                               | 3 ✅     |
| F10 | Fight terror groups                          | Terror threat, intelligence, counter-terror operations           | 3 ✅     |
| F11 | Ensure your own safety                       | Presidential security, assassination and coup risk               | 3 ✅     |
| F12 | Army with 10+ weapon types                   | Armed forces, procurement, upkeep                                | 4 ✅     |
| F13 | Army drills                                  | Drills raise readiness and morale and deter rivals               | 4 ✅     |
| F14 | Espionage against enemy armies               | Intelligence ops: recon, sabotage, counter-intelligence          | 4 ✅     |
| F15 | Wars & expansion                             | War resolution, fronts, annexation                               | 4 ✅     |
| F16 | Nuclear program                              | Research, warheads, deterrence, doctrine                         | 4 ✅     |
| F17 | World map                                    | Interactive world map with an India detail view                  | 5 ✅     |
| F18 | Trade contracts                              | Bilateral trade deals                                            | 5 ✅     |
| F19 | Non-aggression pacts                         | Treaties and relations                                           | 5 ✅     |
| F20 | Game over / end states                       | Impeachment, coup, assassination, term victory                   | 3 / 6 ✅ |

### 2.2 Explicit improvements already in Stage A (cheap wins)

- No ads and no in-app purchases. "Cheat" toggles such as _disable wars_ become **difficulty settings**.
- Pause and speed controls (1×, 2×, 4×) with auto-pause on critical events.
- "Why?" breakdown tooltips on every key indicator.
- Charts with 1-year, 5-year and full-history views for every indicator.
- Multiple save slots, autosave, and save versioning.
- A tutorial and an in-game encyclopedia ("Constitution" handbook).

### 2.3 Out of scope for Stage A (moved to Phase 7 backlog)

Parliament (Lok Sabha and Rajya Sabha), the 28 states and 8 union territories as playable entities, elections and parties, the RBI and monetary policy, news and media, multiplayer, modding, mobile builds.

---

## 3. Technology

| Concern        | Choice                                                                                                                  | Why                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Language       | **TypeScript (strict)**                                                                                                 | It is the team's existing skill and gives one language for sim, UI and tests |
| UI             | **React 18 + Vite**                                                                                                     | Fast hot module replacement (HMR), and the game is UI- and dashboard-heavy   |
| Styling        | CSS Modules plus design tokens (CSS variables)                                                                          | A themeable "Apex" visual identity without a heavy framework                 |
| State          | **Zustand** (UI store) wrapping the immutable `GameState`                                                               | Simple, testable, no boilerplate                                             |
| Charts         | Recharts                                                                                                                | Indicator history graphs                                                     |
| Maps           | SVG (TopoJSON → SVG via d3-geo at build time)                                                                           | Crisp at any zoom; Natural Earth India-POV data                              |
| Simulation     | Pure TS module `src/sim/`, **with no React or DOM imports**                                                             | Portable to mobile, workers and headless runners                             |
| RNG            | Seeded PRNG (mulberry32 / sfc32)                                                                                        | Deterministic replays and tests                                              |
| Persistence    | JSON saves via a storage adapter (localStorage → filesystem on desktop → Capacitor Preferences or Filesystem on mobile) | One format, many backends                                                    |
| Unit tests     | **Vitest**                                                                                                              | Sim formulas, reducers, migrations                                           |
| UI / E2E tests | **Playwright (Google Chrome only)**                                                                                     | Smoke flows and visual checks                                                |
| Lint / format  | ESLint + Prettier, `tsc --noEmit`                                                                                       | CI quality gate                                                              |
| CI             | GitHub Actions                                                                                                          | lint → typecheck → unit → e2e → build                                        |
| Desktop        | **Electron** (Phase 6)                                                                                                  | Simplest path to an `.exe` and to Steam                                      |
| Mobile         | **Capacitor** (Phase 7)                                                                                                 | Same web build goes to the Play Store and App Store                          |

---

## 4. Architecture

```
Power/
├─ planning/                  # This plan, phases, sprints
├─ content/                   # Game data as JSON (validated by zod schemas)
│  ├─ countries.json  ministries.json   departments.json  facilities.json
│  ├─ police.json     power.json        goods.json        industries.json
│  ├─ weapons.json    events/*.json     ideologies.json
├─ src/
│  ├─ sim/                    # PURE simulation, no UI imports (lint-enforced)
│  │  ├─ state/               # GameState types, initial state factory
│  │  ├─ systems/             # economy, politics, security, military, diplomacy, events
│  │  ├─ commands/            # Player actions → validated state transitions
│  │  ├─ engine/              # tick(), clock, scheduler, seeded RNG
│  │  └─ save/                # serialize, migrate, validate
│  ├─ ui/                     # React screens and components
│  │  ├─ design/              # tokens, theme, primitives (Panel, Stat, Gauge, Button)
│  │  ├─ screens/             # Shell; views/ hold Dashboard, Economy, Departments, Construction, … , World
│  │  └─ map/                 # SVG world/India map
│  ├─ store/                  # Zustand bridge: dispatch(command), subscribe(state)
│  └─ platform/               # storage and shell adapters (web / electron / capacitor)
├─ tools/
│  └─ balance/                # Headless bot runner: simulate N years × M seeds → CSV report
└─ tests/  e2e/
```

### 4.1 Core loop (engine)

```
Player command ──► commands/<cmd>.ts (validate) ──► new GameState
                                                     │
Game clock tick (1 day) ──► engine.tick(state, rng) ─┤
   ├─ daily:   events roll, war fronts, security checks
   ├─ monthly: economy settlement, goods market, loans, approval update, department funding
   └─ yearly:  annual budget, GDP report, term counter, stat snapshots
                                                     ▼
                                            UI re-renders from state
```

- `GameState` is **immutable**. Every tick and command returns a new state, which makes undo, replay and tests trivial.
- Systems run in a **fixed order** each tick: economy → society → security → military → diplomacy → events → approval. This keeps the simulation deterministic.
- A **modifier stack** (`{source, target, value, expires}`) is the single mechanism for ideology, departments, events and policies. It also powers the "Why?" tooltips.

---

## 5. Simulation model (v1)

All values are normalised and tuned in Phase 6. Formulas live in `src/sim/systems/*` and have unit tests.

### 5.1 Time

- 1 tick = 1 in-game day. Speeds are paused, 1× (1 day/s), 2× and 4×.
- The game starts on **1 Jan of the current year**, and a term lasts 5 years. On election day (1 January after five years) approval plus a small campaign swing must reach the difficulty's bar to win a second term (55% on Easy, 58% on Normal and Hard since Phase 8); voter fatigue lowers approval each year, faster on harder difficulties. A re-elected President may stay on in endless mode (Phase 6).

### 5.2 Economy

| Variable                    | Description                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gdp`, `gdpGrowth`          | GDP in ₹ lakh crore, made up of sector outputs                                                           |
| `sectors`                   | Agriculture, Industry, Services, Energy, Tech. Each has an output, a growth rate and an investment level |
| `treasury`                  | Cash balance in ₹ crore                                                                                  |
| `revenue`                   | Income tax, corporate tax, GST, customs and the trade balance                                            |
| `expenditure`               | Per-ministry allocation, military upkeep, debt interest                                                  |
| `debt`, `debtToGdp`         | Borrowing when the treasury goes negative                                                                |
| `inflation`, `unemployment` | Driven by spending, taxes, growth and shocks                                                             |
| `population`, `hdi`         | Living standards from health, education and income                                                       |

Monthly settlement: `treasury += revenue − expenditure`. Growth is driven by investment, stability, corruption drag, tax burden, and strategy and ideology modifiers.

### 5.3 Governance

- **No ministers (Phase 8).** Each of the eleven ministries (Finance, Home Affairs, Defence, External Affairs, Health, Education, Agriculture, Industry & Commerce, Disaster Management, Intelligence, Anti-Corruption) is a department the President runs directly. Its services are rated 1–5 stars, bought with treasury money and lost to long underfunding. Efficiency = funding × service quality × national corruption. (Stage A had appointed ministers with competence, loyalty and corruption; [Phase 8](../Phases/phase_8_hands_on_governance.md) replaced them.)
- **Hands-on screens (Phase 8).** The President builds and buys directly, and every effect is measured against the opening state, so a new game starts balanced:
  - **Construction:** schools, clinics, hospitals, water, housing and transport by region; coverage drives HDI, public services, unrest, growth and jobs.
  - **Police:** officers, stations, units and agencies; they drive crime, unrest, terror and corruption, and over-policing costs civil liberties.
  - **Energy:** a national grid of power plants; a shortfall means power cuts (growth and approval), and dirty plants mean air pollution.
  - **Industry:** state and licensed private plants turn goods into goods; their output, jobs and profits feed the economy and the treasury.
  - **Trade Market:** goods are bought and sold with partners at prices set by relations and distance, with tariffs, quotas, bans and supply contracts.
  - **Armoury:** units are bought from the treasury and delivered within weeks.
  - **Finance:** money by the day, general expenses, and loans from friendly countries or an international lender.
  - **The advisor** names the most urgent problem and opens the screen that fixes it.
- **Ideologies:** Liberalism, Socialism, Conservatism, Nationalism, Technocracy. Each gives economic, approval, diplomatic and military modifiers.
- **Development strategies:** Agrarian, Industrial, Services & Tech, Defence-first, Balanced.
- **Approval** (0–100) is a weighted mix of economy (jobs, inflation), safety, corruption, crises handled and war weariness. It drifts toward a target, with shocks from events.

### 5.4 Domestic security

| Variable                        | Driver                                     | Consequence                            |
| ------------------------------- | ------------------------------------------ | -------------------------------------- |
| `corruption`                    | Department quality, anti-corruption budget | Budget leakage, approval drag          |
| `crime` / `unrest` (per region) | Unemployment, inflation, police funding    | Riots, which cost GDP and approval     |
| `terrorThreat`                  | Intelligence funding, border tension       | Attacks, which cost approval and lives |
| `presidentSafety`               | Security service funding, loyalty          | Assassination attempts                 |
| `coupRisk`                      | Low military loyalty, low approval         | Game over                              |

### 5.5 Military

- **Unit types (12):** Infantry, Special Forces, Main Battle Tanks, Artillery, Air-Defence, Fighter Jets, Bombers, Attack Helicopters, Drones, Warships, Submarines, Ballistic Missiles, plus **Nuclear Warheads** (separate program).
- Each unit type has `cost`, `upkeep`, `attack`, `defence`, `buildDays` and a `domain` (land, air, sea or strategic).
- `readiness`, `morale` and `techLevel` multiply strength. **Drills** cost money, raise readiness and morale, and raise deterrence.
- **War:** a front-based auto-resolver runs daily rounds of strength × readiness × terrain × RNG. The outcome is a ceasefire, annexation (territory gain) or defeat.
- **Nuclear:** research → enrichment → warheads. It gives large deterrence. Use triggers a catastrophic global and diplomatic response, and the design discourages it.

### 5.6 Diplomacy

- About 195 countries, each with `relation` (−100…+100), `power`, `gdp`, `ideology` and `aggression`.
- **Treaties:** trade contract (+revenue, +relation), non-aggression pact, embassy, sanctions.
- **AI:** each month, every country evaluates offers and threats by utility (relation, power ratio, ideology match). A focus set of about 20 key countries gets detailed AI, and the rest are simplified.

### 5.7 Events

- Events are data-driven JSON with `conditions`, `weight`, `choices[]` and `effects[]` (as modifiers), and an optional follow-up chain.
- Categories: Disaster, Economy, Corruption, Security, Terror, Military, Diplomacy, Personal (president safety).
- Target for Stage A: **≥ 120 events**.

---

## 6. UX & visual identity ("Apex" style)

- **Look:** a dark "command centre" theme by default, with a light theme option. Saffron, white and green appear as **accent** colours on a deep navy and charcoal base, never as flat flag colours. Typography is Inter or Noto Sans, which covers Devanagari for future Hindi localisation.
- **Layout (PC):** top bar (date, speed, treasury, approval, alerts), left nav rail (Dashboard, Economy, Cabinet, Security, Military, World, Reports), main panel, and a right-side inbox and event feed.
- **Responsive from day one:** it must collapse to a bottom-tab layout at ≤ 768 px, ready for mobile in Phase 7.
- **Accessibility:** full keyboard navigation, colour-blind-safe charts, scalable UI (90–150%).

---

## 7. Quality strategy

| Layer              | Tooling                                                                                                                                                           | Gate                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Static             | ESLint, Prettier, `tsc --noEmit`, import rule "sim must not import ui"                                                                                            | CI blocks a merge on any failure |
| Unit               | Vitest, ≥ 85% line coverage on `src/sim/`                                                                                                                         | CI                               |
| Determinism        | Same seed + same commands ⇒ identical state hash after 5 in-game years                                                                                            | CI                               |
| Save compatibility | Golden save fixtures per schema version must load                                                                                                                 | CI                               |
| Balance            | `tools/balance`: 50 seeds × 5 years × 3 bot strategies, with KPI bands (e.g. a passive bot is not bankrupt before year 2; an optimal bot can't hit 100% approval) | Run each sprint from Phase 2     |
| E2E                | Playwright (Chrome): new game → play 1 year → save → load                                                                                                         | CI                               |
| Manual             | Playtest checklist per sprint, logged in the sprint file                                                                                                          | Definition of Done (DoD)         |

### 7.1 Definition of Done (every sprint)

1. `npm run lint`, `npm run typecheck` and `npm test` exit 0.
2. New simulation logic has unit tests, and the determinism test is still green.
3. The UI works at 1920×1080 and at 768 px wide.
4. Content JSON passes schema validation.
5. The sprint file has its checklist ticked, a playtest note, and known issues logged.
6. The work is merged to `main` via a PR with conventional commits.

---

## 8. Roadmap

Sprints are **2 weeks** long, sized for a hobby pace of about 8–10 hours a week. Capacity is about **8 story points (SP) per sprint**.

| Phase             | Name                                                                     | Sprints                             | SP         | Target window       |
| ----------------- | ------------------------------------------------------------------------ | ----------------------------------- | ---------- | ------------------- |
| 1                 | [Foundations](../Phases/phase_1_foundations.md)                          | 1.1 – 1.3                           | 24         | Oct – Nov 2026      |
| 2                 | [Economy & Governance](../Phases/phase_2_economy_governance.md)          | 2.1 – 2.4                           | 32         | Dec 2026 – Jan 2027 |
| 3                 | [Domestic Affairs & Security](../Phases/phase_3_domestic_security.md)    | 3.1 – 3.3                           | 24         | Feb – Mar 2027      |
| 4                 | [Military & Defence](../Phases/phase_4_military.md)                      | 4.1 – 4.3                           | 24         | Mar – Apr 2027      |
| 5                 | [Diplomacy & World](../Phases/phase_5_diplomacy_world.md)                | 5.1 – 5.3                           | 24         | May – Jun 2027      |
| 6                 | [Polish & PC Release (Parity v1.0)](../Phases/phase_6_polish_release.md) | 6.1 – 6.3                           | 24         | Jul – Aug 2027      |
| 7                 | [Apex: Beyond Parity & Mobile](../Phases/phase_7_apex_mobile.md)         | Backlog (to be sprinted after v1.0) | —          | Sep 2027 +          |
| 8                 | [Hands-on Governance](../Phases/phase_8_hands_on_governance.md)          | 8.1 – 8.9                           | 61         | Ahead of Phase 7    |
| **Total Stage A** |                                                                          | **19 sprints**                      | **152 SP** | **~10 months**      |

### 8.1 Milestones

| Milestone                  | Exit criteria                                                                           | After      |
| -------------------------- | --------------------------------------------------------------------------------------- | ---------- |
| **M1: Playable Skeleton**  | The clock runs, the treasury changes, and save and load work                            | Sprint 1.3 |
| **M2: Nation Builder**     | A full economy, cabinet, ideology and approval loop. You can win or lose on the economy | Sprint 2.4 |
| **M3: Crisis Manager**     | Events, disasters, corruption, terror and riots. All game-over states exist             | Sprint 3.3 |
| **M4: Commander-in-Chief** | Army, drills, espionage, war and nuclear                                                | Sprint 4.3 |
| **M5: World Stage**        | World map, AI nations, treaties and trade. **Feature parity reached**                   | Sprint 5.3 |
| **M6: v1.0 PC Release**    | Balanced, tutorial, Electron builds, itch.io page (Steam later)                         | Sprint 6.3 |

---

## 9. Risks

| Risk                                                | Impact                          | Mitigation                                                                          |
| --------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| Scope creep ("just one more system")                | Never ships                     | Parity checklist is the contract; extras go to the Phase 7 backlog                  |
| Balance spirals (runaway GDP or instant bankruptcy) | Not fun                         | Headless balance runner from Phase 2; clamp and normalise formulas                  |
| Map or political sensitivity                        | Legal, reviews, store rejection | Official boundary data, fictional people, neutral event writing, review pass in 6.1 |
| Hobby time variance                                 | Slipped dates                   | 8 SP capacity with buffer; phases are independently shippable                       |
| Performance with ~195 AI nations ticking daily      | Lag on low-end PCs or mobile    | Monthly AI cadence, focus-set AI, Web Worker sim in Phase 6 if needed               |
| Electron or Capacitor packaging surprises           | Release delay                   | Spike a "hello world" package build in Sprint 1.1                                   |

---

## 10. Working agreements

- **Branches:** `feat/sprint-X.Y-<slug>` → PR → `main`.
- **Commits:** conventional style, e.g. `feat(sim): …`, `fix(ui): …`, `docs(planning): …`.
- **Links:** relative markdown links only, never absolute local paths.
- **Each sprint file** tracks stories, tasks, acceptance criteria, a DoD checklist and a playtest log.

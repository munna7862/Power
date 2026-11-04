# Changelog

All notable changes. Versions follow [semantic versioning](https://semver.org/); save files stay loadable from schema v7 on (golden fixtures in `tests/fixtures/saves`); 2.0.0 is the one deliberate break.

## Unreleased — Phase 9: Soundtrack

### Added

- **An adaptive soundtrack.** The music follows the country: a calm theme in peacetime, a tense one when a region nears riots or approval nears impeachment, a heavy war theme while a war is on, and a build-up over the last six months before election day. Moods change on a bar line with a crossfade. Every note is synthesised in code, so the game still ships no audio files.
- **Musical cues** for war declared, peace, victory and defeat.
- **Music style** in Settings: _Follows the country_, _Calm only_ or _Off_.

### Changed

- Sound pauses while the game window is hidden.

## 2.0.0 — Phase 8: Hands-on Governance

The President now runs the country directly: no ministers, and every school, power plant, factory, police officer and tank is yours to buy. This is the first release with downloadable builds; the 1.0.0 builds were never published (see 1.0.0 below).

### Added

- **Departments replace the cabinet.** Eleven departments, each with services rated 1–5 stars. Stars are bought from the treasury and lost after six months of bad underfunding. Anti-corruption inquiries become department audits.
- **Construction.** Schools, universities, clinics, hospitals, water, housing and transport, built by region in weeks or months. Coverage drives HDI, public services, unrest, growth and jobs, and wears down as the population grows.
- **Police & Internal Affairs.** Officers, stations, equipment, special units and agencies, with a regional crime stat and a civil-liberties cost for over-policing. Counter-terror operations and audits moved here.
- **Energy.** A national grid of six plant types; shortfalls cause power cuts, surplus is exported, and dirty plants cost approval through air pollution.
- **Industry.** 18 plant types turning 15 goods into goods, state-run or licensed to private investors who follow the business climate. State plants can be sold to private investors.
- **Trade Market.** Buy and sell goods with partners at prices set by relations and distance; sell all surplus, sell on the world market, standing supply contracts, and tariffs, quotas and bans per good.
- **The Armoury.** One screen to buy the military from the treasury, with delivery in days to weeks.
- **Daily money, loans and the advisor.** The treasury shows its daily change and general expenses; take and repay loans from friendly countries or an international lender; repay public debt early; an advisor names the most urgent problem and opens the screen that fixes it.
- **Revenue follows the economy.** Income tax follows jobs, customs follows tariffs, and power sales, tolls and fares earn revenue, each with a "Why?" breakdown. One-off receipts show in the monthly figures.
- **New Game options:** **Regional play** (turn it off to run one India without region pickers) and **Calm months** (at most one random event a month).

### Changed

- Re-election needs 58% approval on Normal and Hard (55% on Easy).
- The Budget screen no longer sets customs; tariffs per good on the Trade Market do.
- Sale contracts only promise spare surplus, and deliveries are shown.

### Fixed

- The ten defects from the v1.0.0 QA review ([docs/qa/top-10-defects.md](docs/qa/top-10-defects.md)), including the 0% customs exploit, critical alerts that stopped pausing the game once the inbox was full, and the clock running while a decision dialog was open.
- The determinism test holds a golden hash per platform, so the release workflow passes on Linux CI.

### Saves

- Save schema v17. **Saves from 1.0 (v1–v6) cannot be continued**: they ran the country through a cabinet of ministers, so loading one shows an explanation and asks you to start a new game. Saves from v7 on keep loading.

## 1.0.0 — 2026-10-11

Feature parity with the country-simulator genre (Stage A). Tagged, but the builds were never published: the release workflow stopped on a determinism test whose golden hash had only been recorded on Windows.

### Added

- **Election day (F20).** A term lasts five years; on 1 January after the fifth year you need 55% approval, give or take a small campaign swing, to win a second term. Voter fatigue grows every year in office. Winners may stay on in **endless mode**.
- **Difficulty that matters.** Easy, Normal and Hard differ in opening money and goodwill, how often crises strike and how hard, how warlike the neighbours are, how fast voter fatigue builds and how soon Parliament impeaches.
- **Game options:** no wars, no riots, guided tutorial.
- **Guided tutorial** for the first month: the budget, the cabinet, a practice decision and the world map.
- **The Constitution:** an in-game handbook explaining every stat and rule, searchable.
- **Music and sound effects**, generated in code, with volume and mute settings.
- **Accessibility:** interface size 90–150%, a colour-blind-safe palette, reduced motion, full keyboard play (Space, 1/2/3, F1–F10, H, Esc).
- **Desktop app** (Electron): Windows installer and portable zip, macOS and Linux builds. Saves go to your user folder, are written crash-safely, and the last three autosaves are kept.
- All UI text is externalised for translation (English now, Hindi planned).

### Changed

- A random event now fires at most twice in any five years, so a term never feels like a rerun.
- Hard's flat approval penalty eased from −5 to −3; voter fatigue does more of the work.
- Balance KPI bands are a blocking CI check, now including difficulty spread, event repetition and the game options.

### Saves

- Save schema v6. Older saves load and start with every option off and outside endless mode.

## 0.5.0 — Phase 5

World map, 205 countries, relations, trade contracts, pacts, embassies, aid, sanctions and AI nations.

## 0.4.0 — Phase 4

Armed forces, procurement, drills, espionage, wars and the nuclear programme.

## 0.3.0 — Phase 3

Event engine, disasters, corruption, unrest, terror, presidential safety and game-over states.

## 0.2.0 — Phase 2

Economy, budget and taxes, cabinet, ideology and strategy, approval.

## 0.1.0 — Phase 1

Game clock, treasury, save and load, the UI shell.

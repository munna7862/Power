# Changelog

All notable changes. Versions follow [semantic versioning](https://semver.org/); save files stay loadable across every version (golden fixtures in `tests/fixtures/saves`).

## 1.0.0 — 2026-10-11

The first public release: feature parity with the country-simulator genre (Stage A), on Windows, macOS and Linux.

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

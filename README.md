# India: Apex Sovereign

[![CI](https://github.com/munna7862/Power/actions/workflows/ci.yml/badge.svg)](https://github.com/munna7862/Power/actions/workflows/ci.yml)

A political and national strategy simulation. You are the President of India for a five-year term: run the economy and the budget, fund departments, build schools and hospitals, run the power grid, industry and trade, manage police and the armed forces, deal with crises and other nations, and face an election at the end.

Code name **Power**. Desktop app built with TypeScript, React, Vite and Electron. No ads, no in-app purchases. Original name, art, text and sound.

![Trailer](docs/release/trailer.gif)

## Status

- **v2.0.0, Hands-on Governance** (Phase 8, Sprints 8.1-8.10): the first release with downloadable builds. It replaces the cabinet with departments that have star-rated services, and adds construction, an energy grid, industry, a trade market, an armoury, police and internal affairs, loans, a daily treasury and an advisor. Save schema is at v17; saves from 1.0 cannot be continued. See [CHANGELOG.md](CHANGELOG.md).
- **Phase 7**: Sprint 7.1, the **Android app** (Capacitor), is in progress; CI builds a debug APK on every pull request. The rest of the backlog (Parliament, states, Hindi, Steam) is re-ranked after launch.
- **v1.0.0** (tagged 2026-10-11, Phases 1-6) was never published as builds: its release run stopped on a determinism test recorded on Windows only. Installers come from the [Releases page](https://github.com/munna7862/Power/releases) from v2.0.0 on, or build them locally with `npm run dist` (see below).

## Tech stack

- TypeScript, React 19, Vite, Zustand, i18next
- Electron 44 and electron-builder (Windows, macOS, Linux)
- Capacitor 8 (Android)
- Zod-validated JSON game content
- Vitest (unit, architecture, save-compatibility and content tests), Playwright (end-to-end in Google Chrome, desktop smoke tests in Electron)
- ESLint, Prettier, GitHub Actions

## Run it

Requires Node.js 22+ (`.nvmrc` pins 24) and Google Chrome for the end-to-end tests.

```bash
npm ci
npm run dev              # browser, http://localhost:5180
npm run electron:start   # desktop app, production build
```

### Android

Building the APK locally needs JDK 21 and the Android SDK (Android Studio installs both). Without them, take `app-debug.apk` from the **Android build** job of any CI run.

```bash
npm run android:sync     # web build, copied into android/
npm run android:build    # debug APK: android/app/build/outputs/apk/debug/app-debug.apk
```

To try it on a phone, allow installs from your file manager or browser, open the APK and install. Phone saves stay in the app's private storage.

Desktop saves go to your user folder (`%APPDATA%\India Apex Sovereign\saves` on Windows), are written crash-safely and keep the last three autosaves. Saves from any earlier version keep loading (golden fixtures in `tests/fixtures/saves`).

## Commands

| Command                  | What it does                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `npm run dev`            | Game in the browser with hot reload                                             |
| `npm run electron:dev`   | Desktop app against the dev server                                              |
| `npm run electron:start` | Build and run the desktop app as players get it                                 |
| `npm run build`          | Production web build into `dist/`                                               |
| `npm test`               | Unit tests (Vitest)                                                             |
| `npm run test:coverage`  | Unit tests with coverage (85% or more required on `src/sim`)                    |
| `npm run test:e2e`       | End-to-end tests in Google Chrome (Playwright)                                  |
| `npm run test:electron`  | Desktop smoke tests in the real Electron app                                    |
| `npm run verify`         | What CI runs: format, lint, typecheck, coverage, build, e2e                     |
| `npm run balance`        | Balance harness: 50 seeds x 5 years x 3 bots x 3 difficulties against KPI bands |
| `npm run dist`           | Desktop installers for this OS into `release/` (`npm run dist:win` for Windows) |
| `npm run screenshots`    | Release screenshots and the trailer GIF                                         |
| `npm run icon`           | App icon from `public/favicon.svg`                                              |
| `npm run android:sync`   | Web build copied into the Android project                                       |
| `npm run android:build`  | Debug APK (needs JDK 21 and the Android SDK)                                    |
| `npm run android:icons`  | Android launcher icons and splash screens from `public/favicon.svg`             |

## Project structure

| Path                   | Contents                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/sim/`             | Pure, deterministic simulation core: no UI, no clock, seeded randomness                                                         |
| `content/`             | Game data as JSON: departments, facilities, police, power, industries, goods, weapons, 205 countries, 144 events, the world map |
| `src/store/`           | Zustand bridge between the simulation and the UI                                                                                |
| `src/platform/`        | Storage and shell adapters for the browser, Electron and the Android app                                                        |
| `src/ui/`              | React screens, design tokens, tutorial, handbook, audio; all UI text in `src/ui/i18n/`                                          |
| `electron/`            | Desktop main process, preload bridge, crash-safe save files                                                                     |
| `android/`             | The Capacitor Android project (generated, plus the icons and theme)                                                             |
| `tests/`               | Unit, architecture, save-compatibility, content-review and desktop tests                                                        |
| `e2e/`, `e2e-desktop/` | Playwright tests in Chrome, and Electron smoke tests                                                                            |
| `tools/`               | Balance harness, world-data builders, release tools                                                                             |
| `planning/`            | Master plan, phases and sprints                                                                                                 |

## CI and releases

- `.github/workflows/ci.yml` runs format check, lint, typecheck, unit tests with coverage, the web build and the Chrome end-to-end tests on every push and pull request, and builds the Android debug APK.
- `.github/workflows/release.yml` runs on a `v*` tag: it verifies, builds Windows, macOS and Linux installers, and publishes a GitHub release with the notes from `docs/release/<tag>.md` (and pushes to itch.io if configured). macOS and Linux builds are unsigned.

## Contributing

Read [AGENTS.md](AGENTS.md) first, then the [planning hub](planning/README.md) and the [master plan](planning/Master/master_plan.md). Credits and asset licences are in [CREDITS.md](CREDITS.md).

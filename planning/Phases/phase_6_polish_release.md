# Phase 6: Polish & PC Release, Parity v1.0 (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 5](phase_5_diplomacy_world.md) · [Phase 7 →](phase_7_apex_mobile.md)

**Phase goal:** turn a feature-complete game into a shippable, fair and fun v1.0 on PC.
**Parity feature:** F20 (term victory) · **Milestone:** **M6: v1.0 PC Release**

---

## Sprint 6.1: Balancing, Difficulty & Content Review (8 SP)

| ID     | Story                                                                                                                 | SP  |
| ------ | --------------------------------------------------------------------------------------------------------------------- | --- |
| S6.1-1 | As a player, Easy, Normal and Hard feel different, and the "cheat" options (no wars, no riots) are difficulty toggles | 2   |
| S6.1-2 | As a developer, balance KPI bands are blocking in CI                                                                  | 2   |
| S6.1-3 | As a player, the event pool totals ≥ 120 with low repetition                                                          | 2   |
| S6.1-4 | As the team, all text, map and content pass the sensitivity and legal review                                          | 2   |

**Tasks**

- [x] Tune formulas from balance reports (target: a 5-year term is winnable but tense on Normal): election day at 55% plus voter fatigue; the balanced bot is re-elected 98% / 86% / 30% on Easy / Normal / Hard
- [x] Repetition check: no event fires more than twice in a 5-year run (except recurring briefings), enforced by the event engine and checked independently by the harness
- [x] Review checklist: fictional people, neutral tone, official map, no trademarked names, no copied reference-game text or art (see the review below; `tests/content/review.test.ts` automates the scan)

---

## Sprint 6.2: Onboarding, Audio, Settings & Accessibility (8 SP)

| ID     | Story                                                                                                         | SP  |
| ------ | ------------------------------------------------------------------------------------------------------------- | --- |
| S6.2-1 | As a new player, a guided tutorial (first 30 days) teaches budget, cabinet, events and the map                | 3   |
| S6.2-2 | As a player, I have an in-game encyclopedia ("Constitution" handbook) explaining every stat                   | 1   |
| S6.2-3 | As a player, I have music and SFX with volume settings                                                        | 1   |
| S6.2-4 | As a player, I have accessibility options: UI scale, colour-blind palette, keyboard shortcuts, reduced motion | 2   |
| S6.2-5 | As a player, the UI text is externalised (i18n-ready; English v1, Hindi in Phase 7)                           | 1   |

**Tasks**

- [x] Royalty-free or CC0 audio only, with a license list in `CREDITS.md`: all audio is synthesised in code, so the game ships no audio files at all ([CREDITS.md](../../CREDITS.md))
- [x] Keyboard map: Space (pause), 1/2/3 (speed), F1–F10 (screens; the plan said F1–F7, but there are ten screens), H (handbook), Esc (menu), F11 (full screen on desktop)
- [x] i18n with `i18next`; no hard-coded strings left in `src/ui` (lint rule `apex/no-ui-literals`)

---

## Sprint 6.3: Electron Packaging & Release (8 SP)

| ID     | Story                                                                                           | SP  |
| ------ | ----------------------------------------------------------------------------------------------- | --- |
| S6.3-1 | As a player, I can install the game on Windows (and macOS and Linux builds where feasible)      | 3   |
| S6.3-2 | As a player, saves go to the OS user-data folder via the filesystem storage adapter             | 2   |
| S6.3-3 | As the team, a release pipeline builds versioned artefacts on tag `v*`                          | 2   |
| S6.3-4 | As the team, a store page goes live on itch.io (free or pay-what-you-want for the hobby launch) | 1   |

**Tasks**

- [x] Electron main and preload with context isolation and no node integration in the renderer (also: sandboxed renderer, custom `app://` scheme with a strict CSP, navigation, pop-ups and permissions refused, sender-checked IPC)
- [x] `electron-builder`: NSIS installer for Windows, plus portable zip (also macOS dmg/zip and Linux AppImage/tar.gz in the release workflow)
- [x] Crash-safe saves: write to temp, then rename; keep the last 3 autosaves (`electron/saves.ts`, with a fallback to the newest readable autosave)
- [x] Release notes, screenshots, trailer GIF ([v1.0.0 notes](../../docs/release/v1.0.0.md), [screenshots](../../docs/screenshots/phase-6), [trailer](../../docs/release/trailer.gif))
- [x] Steam is evaluated after feedback (Steamworks fee and page; see the Phase 7 backlog)

**Demo (M6):** a clean Windows machine installs the game, plays the tutorial, saves, quits, relaunches and continues. Automated in `e2e-desktop/desktop.spec.ts`, which passes against both the unpacked build and the packaged `release/win-unpacked` executable.

---

## Phase 6 exit checklist

- [ ] v1.0.0 tagged and released: everything is ready; after this phase merges, push the tag (`git tag v1.0.0 && git push origin v1.0.0`) and the release workflow publishes the installers
- [ ] Feedback channel set up (itch.io comments or a Discord server): needs the itch.io page ([copy and checklist](../../docs/release/itch-page.md)), which needs the owner's account
- [ ] Phase 7 backlog re-prioritised using player feedback: after launch, once there is feedback
- [x] **Parity checklist complete:** F20 (term victory) done, so F1–F20 are all ticked in the [master plan](../Master/master_plan.md)

---

## Balance KPI bands

`npm run balance` plays 50 seeds × 5 years × 3 bots on **every difficulty**, a war probe and two option probes, and fails if any band fails. It is a **blocking** CI job from this phase. These bands **add to** the Phase 3, 4 and 5 bands, which all still hold (results below are at merge).

| KPI                         | Band                                                                                               | Result at merge  |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------- |
| `normal-winnable-but-tense` | The balanced bot wins re-election on Normal in 50–90% of seeds                                     | ✅ 86%           |
| `difficulty-ordering`       | Balanced re-election: Easy ≥ Normal ≥ Hard, and Easy at least 20 points above Hard                 | ✅ 98 / 86 / 30% |
| `hard-winnable`             | The balanced bot still wins re-election on Hard in ≥ 20% of seeds                                  | ✅ 30%           |
| `low-repetition`            | No random event fires more than twice in any run (all bots, all difficulties)                      | ✅ max 2         |
| `event-variety`             | A full balanced term on Normal sees at least 45 different events on average                        | ✅ 67.1          |
| `no-wars-option`            | With "no wars", no war ever starts (hands-off and balanced bots, Hard)                             | ✅ 0 runs        |
| `no-riots-option`           | With "no riots", unrest never rises above 58 and no riot event fires                               | ✅ peak 58, 0    |
| Phase 3–5 bands             | Unchanged (passive out by year 3: 90%; balanced serves the term: 98%; no approval above 90%: 60.9) | ✅ all 14        |

"Completes the term" now means serving all five years (re-elected or voted out); "re-elected" is the new, harder bar.

| Difficulty | Balanced: served / re-elected / final approval | Passive: served | Greedy: served |
| ---------- | ---------------------------------------------- | --------------- | -------------- |
| Easy       | 98% / 98% / 67.1%                              | 34%             | 0%             |
| Normal     | 98% / 86% / 57.8%                              | 2%              | 0%             |
| Hard       | 92% / 30% / 53.8%                              | 0%              | 0%             |

---

## Delivery notes (2026-10-11)

### What was built

- **Election day (F20)** (`src/sim/systems/term.ts`): on 1 January after five years the voters decide. Approval plus a campaign swing of up to ±4 points must reach 55% (the same bar on every difficulty: "a clear mandate"). Winning is a victory (`reelected`); falling short is `votedOut`. A re-elected President may stay on in **endless mode** (`CONTINUE_IN_OFFICE`), with no further elections. **Voter fatigue** lowers the approval target each year after the first (−2 / −5 / −5 a year on Easy / Normal / Hard, for up to four years); it is a modifier, so it appears in the Dashboard's "Why?" tooltip, and the inbox announces when it starts.
- **One difficulty table** (`src/sim/state/difficulty.ts`): opening treasury and approval, permanent modifiers, event frequency and severity, the rivals' war chance (×0.5 / ×1 / ×1.5), voter fatigue and the impeachment threshold (12 / 15 / 18%). The New Game screen and the handbook read the same table.
- **Game options** (`meta.options`): **no wars** (no declaration chance for any rival, and India's `DECLARE_WAR` is refused), **no riots** (unrest held at 58, below the 60 every riot event needs; a content test keeps it that way), **tutorial** (schedules a practice decision for day 4 and keeps the first week free of random events).
- **Event repetition** (`events.fired`): a random event fires at most twice in any five-year window. Weight-0 events (follow-ups, terror warnings, aftermaths) are briefings the simulation raises itself and are exempt. The pool is **143 events** (133 random, 10 briefings); a balanced term sees about 67 different ones.
- **i18n** (`src/ui/i18n`): i18next with one English JSON file per area, merged into one namespace whose keys TypeScript checks. The lint rule **`apex/no-ui-literals`** (`eslint-rules/`) fails on JSX text, string children, text attributes (`aria-label`, `title`, `placeholder`, `label`…) and `label:`-style properties in `src/ui`. 634 literals were moved.
- **Tutorial** (`src/ui/tutorial`): twelve steps in a non-modal coach panel that highlights the control it is talking about and moves on when the player acts (opens the Budget, Cabinet or World screen, starts the clock, answers the practice decision). Ticked by default until the player has finished or skipped it once.
- **The Constitution** (`src/ui/handbook`): a searchable handbook of 48 entries in 8 sections covering every stat and rule. Numbers (thresholds, fatigue, limits) are interpolated from the simulation's own constants, so the text cannot drift from the rules.
- **Audio** (`src/ui/audio`): ambient music and six sound effects synthesised with the Web Audio API; music and effects volume and mute in Settings; sound unlocks on the first click or key press, as browsers require.
- **Settings and accessibility**: theme, interface size (90 / 100 / 110 / 125 / 150%, by CSS zoom), a colour-blind-safe palette (Okabe–Ito blue and orange replace green and red, in both themes; the map and charts follow), reduced motion (follow the OS, force on or force off), and the keyboard map. Preferences are validated field by field.
- **Desktop app** (`electron/`): main process, a CommonJS preload exposing `window.apexDesktop` (quit, full screen, four save calls) and `SaveFolder`, which writes to a temporary file, flushes it, then renames, and rotates three autosaves. The renderer picks the desktop storage and shell automatically (`src/platform`). Builds: NSIS installer and portable zip on Windows (built and smoke-tested locally), dmg/zip on macOS and AppImage/tar.gz on Linux (built by the release workflow).
- **Release pipeline** (`.github/workflows/release.yml`): on a `v*` tag it verifies (including a tag/version check and the balance harness), builds on Windows, macOS and Linux, publishes a GitHub release with `docs/release/<tag>.md` as notes, and pushes to itch.io with butler when the secret and variable are set. CI gained a blocking balance job and a desktop smoke-test job.
- **Release media**: `npm run screenshots` plays a scripted tour and writes [nine screenshots](../../docs/screenshots/phase-6) and the [trailer GIF](../../docs/release/trailer.gif); `npm run icon` renders the app icon from the favicon. [Store page copy](../../docs/release/itch-page.md), [release notes](../../docs/release/v1.0.0.md), [CHANGELOG](../../CHANGELOG.md) and [CREDITS](../../CREDITS.md).
- **Saves**: schema v6 with a v5 → v6 migration (options off, not endless, empty repeat record) and the golden fixture `tests/fixtures/saves/v6.json`. Version 1.0.0.

### Deviations from the plan

- **The re-election bar is 55% on every difficulty**, not "≥ 50% difficulty-scaled" as the master plan sketched. Balance showed a strong player settles near 72% approval, so a threshold alone could not make Normal tense; voter fatigue does the work and keeps the rule simple to explain. Hard's flat approval penalty was eased from −5 to −3 so that fatigue, not a fixed handicap, makes Hard hard.
- **Audio is synthesised, not licensed.** The plan asked for royalty-free or CC0 files; generating the sound in code avoids third-party licences entirely.
- **F1–F10, not F1–F7**: there are ten screens.
- **Simulation text stays English.** Event stories, inbox reports and the sim's "Why?" labels come from `/content` and `src/sim`, not from the UI catalogue; translating them is part of the Hindi work in Phase 7. Where the UI showed a sim label for something it owns (growth drivers, sectors, relation levels, operations, drills), the UI now translates it from an id (`relationLevel()` was added for this).
- **itch.io is prepared, not live.** Creating the page and its feedback channel needs the owner's account; the copy, checklist and automated butler upload are ready.
- **The installer was smoke-tested as its unpacked app**, not by running the installer on this machine (that would add shortcuts and an uninstall entry). The packaged `win-unpacked` executable passes the same desktop tests.
- **Local Windows packaging** hit an antivirus file lock when electron-builder renamed its freshly extracted Electron folder; `npm run dist:win` therefore reuses the Electron binaries npm already installed (`electronDist`). The release workflow builds normally.

### Sensitivity and legal review (master plan §1.3)

| Check                       | Result                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original identity           | ✅ name, icon, UI, text and sound are original; the icon is the project's own favicon; audio is generated in code; no reference-game name or asset appears (automated scan)                                                                 |
| Fictional people and groups | ✅ ministers and Presidents are generated from neutral name pools; militant groups are fictional; `tests/content/review.test.ts` scans all content and the UI catalogue for real politicians, parties and organisations                     |
| No religion or caste        | ✅ unrest is regional and causal; the same test blocks communal terms everywhere except the Security screen's one explicit disclaimer                                                                                                       |
| Neutral tone toward states  | ✅ unchanged from Phase 5: one template and one formula for every country; the new tutorial event and handbook describe mechanics, never real disputes                                                                                      |
| Official map                | ✅ the map is untouched and `tests/world/boundary.test.ts` still passes                                                                                                                                                                     |
| No trademarked weapon names | ✅ generic class names only; the review test blocks named products (fighters, missiles, tanks, carriers) in all content and UI text                                                                                                         |
| Third-party licences        | ✅ only permissive open-source software and public-domain data; listed in [CREDITS.md](../../CREDITS.md). `npm audit` reports one moderate advisory in `sprintf-js`, pulled in by electron-builder's build tooling only; it is not shipped. |

### Playtest log

- Played the tutorial end to end in Chrome and in the packaged Windows app: every step advances on the right action, and the practice decision arrives on day 4 without interruptions.
- Checked 125% interface size, the colour-blind palette and the light theme on every screen; fixed the Security unrest table spilling into the next panel at large sizes.
- Staged a re-election and a defeat through the dev hook: the verdict, summary and endless-mode button read correctly, and endless mode carries on past the election.
- The handbook search found the gap that "Winning" did not mention voter fatigue; it does now.

### Known issues → Phase 7 backlog

- Simulation text (events, inbox, sim "Why?" labels) is English only; the Hindi work should move it to the catalogue too.
- The installers are unsigned (SmartScreen and Gatekeeper warn on first run); code signing belongs with the Steam evaluation.
- The balance targets the balanced bot, a strong player. How tense Normal feels for people needs real playtest feedback; the difficulty table makes adjustments one-line changes.
- Store notices raised by the game store (save failed, game saved) are still English strings in `src/store`; they should move to the catalogue with the sim text.
- There is no in-game way to replay the tutorial once finished other than starting a new game with the box ticked.

# Phase 6: Polish & PC Release, Parity v1.0 (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 5](phase_5_diplomacy_world.md) · [Phase 7 →](phase_7_apex_mobile.md)

**Phase goal:** turn a feature-complete game into a shippable, fair and fun v1.0 on PC.
**Milestone:** **M6: v1.0 PC Release**

---

## Sprint 6.1: Balancing, Difficulty & Content Review (8 SP)

| ID | Story | SP |
|---|---|---|
| S6.1-1 | As a player, Easy, Normal and Hard feel different, and the "cheat" options (no wars, no riots) are difficulty toggles | 2 |
| S6.1-2 | As a developer, balance KPI bands are blocking in CI | 2 |
| S6.1-3 | As a player, the event pool totals ≥ 120 with low repetition | 2 |
| S6.1-4 | As the team, all text, map and content pass the sensitivity and legal review | 2 |

**Tasks**
- [ ] Tune formulas from balance reports (target: a 5-year term is winnable but tense on Normal)
- [ ] Repetition check: no event fires more than twice in a 5-year run (except recurring briefings)
- [ ] Review checklist: fictional people, neutral tone, official map, no trademarked names, no copied reference-game text or art

---

## Sprint 6.2: Onboarding, Audio, Settings & Accessibility (8 SP)

| ID | Story | SP |
|---|---|---|
| S6.2-1 | As a new player, a guided tutorial (first 30 days) teaches budget, cabinet, events and the map | 3 |
| S6.2-2 | As a player, I have an in-game encyclopedia ("Constitution" handbook) explaining every stat | 1 |
| S6.2-3 | As a player, I have music and SFX with volume settings | 1 |
| S6.2-4 | As a player, I have accessibility options: UI scale, colour-blind palette, keyboard shortcuts, reduced motion | 2 |
| S6.2-5 | As a player, the UI text is externalised (i18n-ready; English v1, Hindi in Phase 7) | 1 |

**Tasks**
- [ ] Royalty-free or CC0 audio only, with a license list in `CREDITS.md`
- [ ] Keyboard map: Space (pause), 1/2/3 (speed), F1–F7 (screens)
- [ ] i18n with `i18next`; no hard-coded strings left in `src/ui` (lint rule)

---

## Sprint 6.3: Electron Packaging & Release (8 SP)

| ID | Story | SP |
|---|---|---|
| S6.3-1 | As a player, I can install the game on Windows (and macOS and Linux builds where feasible) | 3 |
| S6.3-2 | As a player, saves go to the OS user-data folder via the filesystem storage adapter | 2 |
| S6.3-3 | As the team, a release pipeline builds versioned artefacts on tag `v*` | 2 |
| S6.3-4 | As the team, a store page goes live on itch.io (free or pay-what-you-want for the hobby launch) | 1 |

**Tasks**
- [ ] Electron main and preload with context isolation and no node integration in the renderer
- [ ] `electron-builder`: NSIS installer for Windows, plus portable zip
- [ ] Crash-safe saves: write to temp, then rename; keep the last 3 autosaves
- [ ] Release notes, screenshots, trailer GIF
- [ ] Steam is evaluated after feedback (Steamworks fee and page; see the Phase 7 backlog)

**Demo (M6):** a clean Windows machine installs the game, plays the tutorial, saves, quits, relaunches and continues.

---

## Phase 6 exit checklist
- [ ] v1.0.0 tagged and released
- [ ] Feedback channel set up (itch.io comments or a Discord server)
- [ ] Phase 7 backlog re-prioritised using player feedback

# Phase 1: Foundations (24 SP)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [Phase 2 →](phase_2_economy_governance.md)

**Phase goal:** a playable skeleton. The project tooling works, the deterministic simulation engine ticks, the "Apex" UI shell exists, and the game saves and loads.
**Milestone:** **M1: Playable Skeleton**

---

## Sprint 1.1: Project Scaffold & Tooling (8 SP)

**Goal:** an empty but production-grade repo that every later sprint builds on.

| ID | Story | SP |
|---|---|---|
| S1.1-1 | As a developer, I can run `npm run dev` and see the app shell in Chrome | 2 |
| S1.1-2 | As a developer, lint, typecheck, unit tests and e2e tests run locally and in CI | 3 |
| S1.1-3 | As a developer, I know Electron packaging works (risk spike) | 2 |
| S1.1-4 | As a developer, I have an architecture guard that stops `src/sim` from importing UI code | 1 |

**Tasks**
- [ ] Vite + React + TypeScript (strict) scaffold; folder layout as per master plan §4
- [ ] ESLint (typescript-eslint, react-hooks, import), Prettier, `tsc --noEmit`
- [ ] Vitest with coverage; Playwright with a Chrome-only project and one smoke test
- [ ] ESLint `no-restricted-imports` rule: `src/sim/**` cannot import `react`, `src/ui`, `src/store` or DOM APIs
- [ ] GitHub Actions `ci.yml`: install → lint → typecheck → unit → e2e → build
- [ ] Throwaway Electron spike that builds a Windows `.exe` of the blank app (document findings, do not merge to main)
- [ ] `README.md`, `AGENTS.md` (project rules), `.gitignore`, `.editorconfig`

**Acceptance criteria**
- A fresh clone followed by `npm ci && npm run verify` passes.
- CI is green on the PR.
- The spike notes are recorded in this file.

---

## Sprint 1.2: Simulation Core & Game Clock (8 SP)

**Goal:** a deterministic engine that advances time and runs systems in a fixed order.

| ID | Story | SP |
|---|---|---|
| S1.2-1 | As the engine, I hold an immutable `GameState` with versioned schema | 2 |
| S1.2-2 | As the engine, I tick day by day with daily, monthly and yearly hooks | 2 |
| S1.2-3 | As the engine, I use a seeded RNG so the same seed gives the same game | 1 |
| S1.2-4 | As a system author, I can apply modifiers `{source, target, value, expires}` | 2 |
| S1.2-5 | As a player, I can pause and switch speed (1×, 2×, 4×) | 1 |

**Tasks**
- [ ] `GameState` v1 types: `meta`, `clock`, `nation` (placeholder treasury, approval), `modifiers`, `log`
- [ ] `createInitialState(seed, options)`
- [ ] `engine.tick(state)` → new state; `SystemRunner` with ordered systems and cadence (daily, monthly, yearly)
- [ ] `rng` (sfc32), with its state stored inside `GameState` so saves resume deterministically
- [ ] Modifier stack: add, expire, and `resolve(target)` → `{ total, breakdown[] }` (this powers the future "Why?" tooltips)
- [ ] Command pattern: `dispatch(state, command)` → validated new state
- [ ] Determinism test: seed 42, 5 years of ticks, then compare the state hash snapshot

**Acceptance criteria**
- Running 1,825 ticks (5 years) headless takes < 1 s.
- The determinism test passes in CI.
- `src/sim` has ≥ 85% coverage.

---

## Sprint 1.3: Apex UI Shell, Save/Load & New Game (8 SP)

**Goal:** a player can start a game, watch time pass, and save and load it.

| ID | Story | SP |
|---|---|---|
| S1.3-1 | As a player, I see the main menu: New Game, Continue, Load, Settings, Quit | 1 |
| S1.3-2 | As a player, I see the top bar (date, speed controls, treasury, approval) and the left nav rail | 2 |
| S1.3-3 | As a designer, I have design tokens and primitives (Panel, Stat, Gauge, Button, Modal, Tooltip) | 2 |
| S1.3-4 | As a player, I can save to 5 slots, autosave monthly, and load | 2 |
| S1.3-5 | As a player, I can choose the difficulty (Easy, Normal, Hard) on New Game | 1 |

**Tasks**
- [ ] Theme tokens: dark (default) and light; saffron and green accents on navy and charcoal; Inter / Noto Sans
- [ ] Zustand store bridge: game loop via `requestAnimationFrame` plus speed, then `tick` and render
- [ ] Storage adapter interface, with the `localStorage` implementation first
- [ ] Save format: `{ schemaVersion, savedAt, checksum, state }`; migration registry (empty for v1)
- [ ] Responsive check: nav rail becomes bottom tabs at ≤ 768 px
- [ ] Playwright e2e: new game → run 30 days → save → reload page → load → date matches

**Acceptance criteria / Demo (M1)**
- Start a new game, run 3 months, save, refresh the browser, load, and resume at the same date and treasury.
- Golden save fixture `v1.json` is committed and loads in a test.

---

## Phase 1 exit checklist
- [ ] M1 demo recorded (GIF or video in the PR)
- [ ] All three sprint DoDs signed off
- [ ] Known issues moved to the Phase 2 backlog

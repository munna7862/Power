# India: Apex Sovereign — Project Rules

Rules for every human and AI contributor. The full design lives in the [master plan](planning/Master/master_plan.md).

## Architecture

- **`src/sim/` is pure.** No React, DOM, `localStorage`, `Date`, `performance` or `Math.random`. ESLint enforces this, and `tests/architecture/simPurity.test.ts` proves the guard works.
- **Determinism.** All randomness goes through the seeded `Rng` whose state lives in `GameState.rng`. Same seed + same commands = same game.
- **Immutability.** `tick()` and `dispatch()` return new state and never mutate their input (tests deep-freeze states to check).
- **Player actions go through `dispatch(state, command)`** in `src/sim/commands`. The UI never edits `GameState` directly.
- **Every gameplay effect is a modifier** (`src/sim/engine/modifiers.ts`), so the "Why?" tooltips can explain it.
- **System order is fixed** in `src/sim/systems/index.ts`. Changing it changes outcomes; review the determinism snapshot when you do.
- **Persistence goes through `src/platform/`** (storage adapters), so Electron and Capacitor can swap the backend.
- **UI and tools import the simulation from `src/sim` (its `index.ts`) only**, never from deep paths.
- **Game data lives in `content/*.json`** and is validated by zod in `src/sim/content`. Ids must match `src/sim/content/ids.ts`.
- **Explanations and the simulation share formulas.** Growth drivers (`economy/growth.ts`), fiscal projections (`projectMonth`) and approval (`politics/approval.ts`) are used by both the monthly systems and the UI, so the "Why?" tooltips can never drift from what the sim does.

## Balance

- `npm run balance` plays 50 seeds × 5 years × 3 bots (`tools/balance`) and checks the KPI bands in `planning/Phases/phase_2_economy_governance.md`. Run it after any formula change and update the bands deliberately, never to make a failure pass.
- Bots act only through `dispatch()`, like a player.

## Save compatibility

- Changing the shape of `GameState` means: bump `SCHEMA_VERSION`, add a migration in `src/sim/save/migrations.ts`, update `src/sim/save/schema.ts`, and add a golden fixture `tests/fixtures/saves/vN.json`.
- Never edit an existing golden fixture. Old saves must keep loading.

## Quality gate

```bash
npm run verify
```

This runs format check, lint, typecheck, unit tests with coverage (≥ 85% on `src/sim`), build and Playwright e2e. CI runs the same steps on every PR.

- Playwright runs in **Google Chrome only** (`channel: 'chrome'`).
- No blind waits in e2e tests. Use web-first assertions; the one deliberate wait (proving the clock stays paused) is commented.
- The dev-only `window.__APEX__` hook exists to fast-forward time in e2e tests. It is stripped from production builds.

## Content rules

- Original name, art and text only. Never copy the reference game's assets.
- Fictional people and groups. No real politicians, parties or organisations.
- Maps must show India's boundaries as per the Survey of India.

## Git

- Branches: `feat/sprint-X.Y-<slug>` (or `feat/phase-N-<slug>` for a whole phase).
- Conventional commits: `feat(sim): …`, `fix(ui): …`, `docs(planning): …`, `ci: …`.
- Relative markdown links only.

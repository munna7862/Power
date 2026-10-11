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

## Events

- Events live in `content/events/<category>.json` and are validated by zod (`src/sim/content/events.ts`). To add a choice, effect or condition type, extend the schema there first, then `src/sim/events`.
- Event text: fictional groups only; unrest is by region and cause (jobs, prices, corruption, policing), never religion or caste; keep terror non-graphic. `tests/sim/events.test.ts` blocks obvious violations but does not replace review.
- Every decision needs exactly one `default` choice (applied if the President does not decide in time).
- Do not draw India's boundary until we have Survey of India data; use the schematic tile map.

## Military

- Military code lives in `src/sim/military/` and its monthly and daily systems in `systems/military.ts`. Strength, funding and war formulas (`strength.ts`, `forces.ts`, `war.ts`) are shared by the systems, the Military screen and the bots, so the "Why?" tooltips cannot drift.
- Units, the research tree and rival states are content: `content/weapons.json`, `research.json`, `rivals.json`. Use generic weapon class names only (no trademarked products). Rivals are fictional until the Phase 5 world map brings real countries with the neutral-tone review.
- Upkeep comes out of the Defence expenditure line; the rest feeds the procurement fund that pays for orders, research and drills. War costs go straight to the treasury.
- Fog of war: the UI shows a rival's strength only through `strengthView()`, never from `state.military.rivals[...].strength`.

## Balance

- `npm run balance` plays 50 seeds × 5 years × 3 bots (`tools/balance`) and checks the KPI bands in `planning/Phases/phase_4_military.md` (which include the Phase 3 bands and a war probe). Run it after any formula change and update the bands deliberately, never to make a failure pass.
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

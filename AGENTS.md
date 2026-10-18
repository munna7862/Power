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
- **UI text lives in `src/ui/i18n/en/*.json`**, never in components: use `t()` (`useTranslation()` in components, `t` from `src/ui/i18n` elsewhere). The lint rule `apex/no-ui-literals` (`eslint-rules/`) blocks hard-coded text in `src/ui`, and TypeScript checks every key. Each top-level section lives in exactly one file. Simulation and content text (events, inbox entries, sim "Why?" labels) is still English and comes from `src/sim` and `/content`.
- **Explanations and the simulation share formulas.** Growth drivers (`economy/growth.ts`), fiscal projections (`projectMonth`) and approval (`politics/approval.ts`) are used by both the monthly systems and the UI, so the "Why?" tooltips can never drift from what the sim does.

## Departments

- There are no ministers. Each ministry is a **department** whose services are rated 1–5 stars (`content/departments.json`, ids in `DEPARTMENT_SERVICES`). Department quality, and the scores that replaced minister loyalty and competence (army command, presidential protection, intelligence skill, leakage pressure), all come from `src/sim/departments/quality.ts`; read them from there.
- Stars are bought with `UPGRADE_SERVICE` and lost when a department stays underfunded (`settleDepartmentFunding`). Corruption inquiries are audits of a department.

## Events

- Events live in `content/events/<category>.json` and are validated by zod (`src/sim/content/events.ts`). To add a choice, effect or condition type, extend the schema there first, then `src/sim/events`.
- Event text: fictional groups only; unrest is by region and cause (jobs, prices, corruption, policing), never religion or caste; keep terror non-graphic. `tests/sim/events.test.ts` blocks obvious violations but does not replace review.
- Every decision needs exactly one `default` choice (applied if the President does not decide in time).
- A random event fires at most twice in any five-year window (`MAX_REPEATS`, `events.fired`). Events with `weight: 0` are briefings the simulation raises itself (follow-ups, terror warnings, the tutorial's practice decision) and are exempt; give an event weight 0 if a system raises it.
- The Security screen uses the schematic tile map for regional unrest. The world map is the only place India's boundary is drawn (see Diplomacy and the world map below).

## Military

- Military code lives in `src/sim/military/` and its monthly and daily systems in `systems/military.ts`. Strength, funding and war formulas (`strength.ts`, `forces.ts`, `war.ts`) are shared by the systems, the Military screen and the bots, so the "Why?" tooltips cannot drift.
- Units, the research tree and rival states are content: `content/weapons.json`, `research.json`, `rivals.json`. Use generic weapon class names only (no trademarked products). The five rivals are real neighbours (China, Pakistan, Myanmar, Bangladesh, Sri Lanka) keyed by ISO code; their war profiles are in `rivals.json` and everything else about them (name, aggression, relation) comes from `countries.json`. Fronts are named for terrain, never for disputed places.
- Upkeep comes out of the Defence expenditure line; the rest feeds the procurement fund that pays for orders, research and drills. War costs go straight to the treasury.
- Fog of war: the UI shows a rival's strength only through `strengthView()`, never from `state.military.rivals[...].strength`.

## Diplomacy and the world map

- Diplomacy code lives in `src/sim/diplomacy/` and runs once a month from `systems/diplomacy.ts` (after the military systems). Every country's relation with India lives in `state.diplomacy.countries` and nowhere else; change it with `adjustRelation()`, `addIncident()` or a treaty, never by editing the state.
- **One path for treaties.** The player's proposals, accepted offers, event effects and the AI's measures all create treaties through `signTreaty()` and end them through `endTreaty()` / `breakTreaty()`, so nobody gets a deal the others could not. Breaking a pact or contract costs reputation and goodwill; keep those numbers in `diplomacy/constants.ts`.
- **Relations are explained by the formula that moves them.** `relationDrivers()` feeds both the monthly drift and the Country panel's "Why?" tooltip. Trade odds come from `tradeAcceptance()` / `pactAcceptance()`, which the roll and the UI both call.
- **Trade is a modifier.** A contract adds an `economy.growth.<sector>` modifier and an `economy.customs` multiplier with a `treaty-<id>` source, so it shows up in the Why? tooltips and vanishes with the treaty.
- **AI nations** (`diplomacy/ai.ts`) draw the same number of random values per nation every month, so one nation's choice never shifts another's. Add an action by extending `AI_ACTIONS`, `scoreActions()` and `performAction()`; the debug overlay then shows it for free.
- **Countries are content.** `content/countries.json` is generated by `tools/world/buildCountries.ts` from Natural Earth data (rounded) plus the hand-tuned focus nations; edit the focus table in the script, not the JSON. The same text rules as events apply: no real leaders, parties or organisations, no religion or caste, and the same neutral templates for every country.
- **The map** (`content/world/map.json`) is built by `tools/world/buildMap.ts` from Natural Earth's India point-of-view file, which draws India's boundaries as per the Survey of India. Never replace it with the default Natural Earth file or hand-edit it. `tests/world/boundary.test.ts` is the blocking check: it must keep passing for any map change.
- Diplomatic events live in `content/events/diplomacy.json` and use the `countryPick` field to name the country they are about (`{country}` in text, also in choice text and outcomes).

## Difficulty, options and the term

- Everything that differs between Easy, Normal and Hard is in one table, `src/sim/state/difficulty.ts` (`rulesFor(state)`). Read rules from there, never by comparing `meta.difficulty` in a system.
- New Game options live in `state.meta.options` (`noWars`, `noRiots`, `tutorial`). A new option needs the schema, a migration default, a probe in `tools/balance/release.ts` and a band.
- The election and voter fatigue are `src/sim/systems/term.ts`. Victory causes are `VICTORY_CAUSES`; "served the term" is `TERM_COMPLETE_CAUSES`. Endless mode (`meta.endless`) only follows a win.

## Desktop and release

- The desktop app is the same web build inside Electron (`electron/`). Keep the renderer locked down: context isolation, no Node integration, sandbox, the `app://` scheme with its CSP, and IPC that checks the sender and validates every argument. The page reaches the desktop only through `window.apexDesktop` (`electron/preload.cts`, typed in `src/platform/desktop.ts`).
- Desktop saves go through `electron/saves.ts`: temporary file, flush, rename; three autosave generations; slot names are whitelisted.
- `npm run test:electron` runs the desktop smoke tests (the M6 demo) in the real Electron app; CI runs them too. Set `APEX_EXECUTABLE` to test a packaged build.
- Releases: bump `package.json`, add `docs/release/v<version>.md` and a CHANGELOG entry, merge, then push the tag `v<version>`. The release workflow refuses a tag that does not match `package.json`.
- Audio is synthesised in code (`src/ui/audio`); do not add audio files without a licence entry in `CREDITS.md`. Every third-party asset or dataset goes in `CREDITS.md`.

## Balance

- `npm run balance` plays 50 seeds × 5 years × 3 bots on every difficulty (`tools/balance`), plus a war probe and the option probes, and checks the KPI bands in `planning/Phases/phase_6_polish_release.md` (which add to the Phase 3–5 bands). It is a **blocking** CI check. Run it after any formula change and update the bands deliberately, never to make a failure pass.
- Bots act only through `dispatch()`, like a player.

## Save compatibility

- Changing the shape of `GameState` means: bump `SCHEMA_VERSION`, add a migration in `src/sim/save/migrations.ts`, update `src/sim/save/schema.ts`, and add a golden fixture `tests/fixtures/saves/vN.json`.
- Never edit an existing golden fixture. Old saves must keep loading, from v7 on. Phase 8 (the hands-on redesign) is the one deliberate break: v1–v6 saves come from the previous edition and are refused with `PREVIOUS_EDITION_MESSAGE`; their fixtures stay to test that message.

## Quality gate

```bash
npm run verify
```

This runs format check, lint, typecheck, unit tests with coverage (≥ 85% on `src/sim`), build and Playwright e2e. CI runs the same steps on every PR.

- Playwright runs in **Google Chrome only** (`channel: 'chrome'`).
- No blind waits in e2e tests. Use web-first assertions; the one deliberate wait (proving the clock stays paused) is commented.
- The dev-only `window.__APEX__` hook exists to fast-forward time in e2e tests. It is stripped from production builds.
- E2e tests start games through `startGame()` in `e2e/support.ts`, which switches the tutorial off unless a test asks for it.
- `tests/content/review.test.ts` scans all content and UI text for real people, parties, organisations, communal framing, trademarked weapon names and the reference game's name. Keep it passing; it does not replace a human read of new text.

## Content rules

- Original name, art and text only. Never copy the reference game's assets.
- Fictional people and groups. No real politicians, parties or organisations.
- Maps must show India's boundaries as per the Survey of India.

## Git

- Branches: `feat/sprint-X.Y-<slug>` (or `feat/phase-N-<slug>` for a whole phase).
- Conventional commits: `feat(sim): …`, `fix(ui): …`, `docs(planning): …`, `ci: …`.
- Relative markdown links only.

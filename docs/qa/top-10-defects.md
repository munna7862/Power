# Top 10 defects: QA review of v1.0.0

- **Build under test:** `main` at `a183ed8` (v1.0.0, after the Phase 6 merge)
- **Date:** 18 Oct 2026
- **Environment:** Windows 11, Node 24.13.0, Google Chrome (Playwright), Vite dev server on port 5180
- **Method:** I ran the quality gate, read the simulation, store, UI, platform and Electron code, and checked every suspected defect with a script against `src/sim` or in the running game. Every defect below was reproduced. None was found from reading alone.

## Quality gate results

| Step                                       | Result                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `prettier --check`                         | Pass                                                                                                                           |
| `eslint . --max-warnings 0`                | Tracked code is clean. The run failed only on `tools/scratch_inspect.ts`, an untracked local file that has since been removed. |
| `npm run typecheck`                        | Tracked code is clean. The run failed only on the same local file (TS6133).                                                    |
| `vitest run --coverage`                    | 424 / 424 tests pass. `src/sim` coverage: lines 97.4%, functions 97.4%, branches 84.2%                                         |
| `npm run build`                            | Pass. Vite warns that a chunk is larger than 500 kB.                                                                           |
| `playwright test` (Chrome)                 | 43 passed, 1 skipped                                                                                                           |
| `npm run balance`, `npm run test:electron` | Not run in this review                                                                                                         |

The whole suite is green, but every defect below survives it. The tests don't cover the paths involved: a full inbox, a minister replaced during an inquiry, an annexed state, a war the rival starts, offers, and tax changes after a treaty is signed.

## Summary

| #                 | Severity | Area                 | Defect                                                                                                             |
| ----------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [DEF-01](#def-01) | Critical | Economy / diplomacy  | **Fixed.** A trade contract signed while the customs rate is 0% gives a customs multiplier of about 600,000%       |
| [DEF-02](#def-02) | High     | Engine / store       | **Fixed.** Critical alerts stop pausing the game once the inbox holds 400 entries                                  |
| [DEF-03](#def-03) | High     | UI                   | **Fixed.** The clock keeps running while a decision dialog is open, so decisions lapse and cost approval           |
| [DEF-04](#def-04) | Medium   | Security / cabinet   | An anti-corruption inquiry lands on whoever holds the post when it ends, not on the minister it was opened against |
| [DEF-05](#def-05) | Medium   | Diplomacy            | An annexed country remains a full diplomatic partner (embassy, aid, pacts, sanctions, events)                      |
| [DEF-06](#def-06) | Medium   | Military / diplomacy | Treaties with a rival that invades India stay in force for the whole war                                           |
| [DEF-07](#def-07) | Medium   | Diplomacy            | Accepting a foreign offer skips the treaty rules (trade with a country India sanctions)                            |
| [DEF-08](#def-08) | Low      | Commands             | Operations, inquiries and decision costs don't check the treasury, so it goes negative                             |
| [DEF-09](#def-09) | Low      | UI / fog of war      | The War screen shows the enemy's true strength                                                                     |
| [DEF-10](#def-10) | Low      | Economy              | The sanctions customs penalty has no floor, so customs revenue can go negative                                     |

---

<a id="def-01"></a>

## DEF-01: A trade contract signed while the customs rate is 0% gives a customs multiplier of about 600,000%

- **Severity:** Critical: it breaks the economy and any player can do it
- **Status:** Fixed on `feat/qa-defect-fixes`. `tradeEffect` now measures the bonus against customs at the default rate; regression test in `tests/sim/diplomacy.test.ts`.
- **Location:** [src/sim/diplomacy/treaties.ts:85-88](../../src/sim/diplomacy/treaties.ts) (`tradeEffect`)

**Description.** When a contract is signed, its customs bonus is stored as a permanent `economy.customs` multiplier. The multiplier is `value × 0.12 / customsBase`, where `customsBase` is customs revenue at the customs rate in force on the day of signing. At 0% the base is 0 and `Math.max(1, …)` turns it into 1, so the multiplier equals 12% of the contract's value in ₹ crore. That number is in the thousands. Customs then raises nothing at 0%, but once the rate goes back up the multiplier applies to real revenue. It also scales with any later customs rise even without the exploit.

**Steps to reproduce** (seed 11, Normal):

1. Enact a budget with customs at 5%, wait 30 days, then enact one with customs at 0% (the limit is 0–40%, 5 points per budget).
2. Propose small trade contracts until one is accepted.
3. Wait 30 days and enact customs at 5%.

**Expected.** The contract adds about the same customs revenue as one signed at the default rate.

**Actual.**

|                                                | Customs multiplier | Customs revenue per month | Total revenue per month |
| ---------------------------------------------- | ------------------ | ------------------------- | ----------------------- |
| Contract signed at 10% (normal play)           | +0.02              | ₹20,137 cr                | ₹3,25,025 cr            |
| Same contract signed at 0%, customs back to 5% | **+5,940**         | **₹6,01,98,198 cr**       | **₹6,05,08,789 cr**     |

One month later the treasury had gone from ₹1,98,258 crore to ₹4,26,60,848 crore and all public debt was repaid.

**Suggested fix.** Compute the bonus against a fixed base (the default customs rate) or store it as an absolute amount of revenue. Cap the multiplier. Add a test that signs at 0% and then raises the rate.

---

<a id="def-02"></a>

## DEF-02: Critical alerts stop pausing the game once the inbox holds 400 entries

- **Severity:** High: it disables a safety feature without any sign, late in nearly every surviving game and for good in endless mode
- **Status:** Fixed on `feat/qa-defect-fixes`. `advanceUntilAttention` now spots new entries by their tick; regression test in `tests/sim/tick.test.ts`.
- **Location:** [src/sim/engine/tick.ts:47-50](../../src/sim/engine/tick.ts) (`advanceUntilAttention`) together with [src/sim/state/log.ts:20](../../src/sim/state/log.ts) (`LOG_LIMIT` trimming)

**Description.** `advanceUntilAttention` spots new inbox entries with `next.log.slice(logBefore)`. Once the log reaches `LOG_LIMIT` (400), `appendLog` drops the oldest entry every time it adds one. The length stays at 400, the slice is always empty, and critical entries (terror attacks, invasions, sanctions, coup warnings, debt crises) no longer stop the clock. New decisions still pause the game, because those are counted separately.

**How often it happens.** With the balanced bot (an active player who survives), the inbox reached 400 entries within the five-year term in **18 of 20 games**, between months 45 and 58. That is the run-up to the election. In endless mode it stays broken for the rest of the game.

**Steps to reproduce:**

1. Script: run `advanceUntilAttention(state, 30, [alarm])`, where `alarm` is a system that appends a critical entry on day 3. With a short inbox it returns `interrupted: true` at day 3. With a 400-entry inbox it returns `interrupted: false` after all 30 days.
2. In the browser: play an Easy game into endless mode until the inbox holds 400 entries. Stage a terror plot that strikes in 2 days and run at 1×.

**Expected.** The game pauses on the critical "Attack in the North" entry, as it does in a new game.

**Actual.** "Attack in the North" (critical) arrived on tick 2373 and the speed stayed at 1×. The same steps in a new game with 9 inbox entries paused the game.

**Suggested fix.** Detect entries by tick or id, not by array length. For example, keep the entries with `e.tick === next.clock.tick`, or compare `nextId` before and after the tick. Add a regression test that starts from a full log.

---

<a id="def-03"></a>

## DEF-03: The clock keeps running while a decision dialog is open, so decisions lapse and cost approval

- **Severity:** High: the player loses approval while doing exactly what the game asks
- **Status:** Fixed on `feat/qa-defect-fixes`. Opening a decision pauses the clock, and **Review** opens the decision with the nearest deadline; tests in `tests/store/gameStore.test.ts` and `e2e/crisis.spec.ts`.
- **Location:** [src/ui/modals/DecisionModal.tsx](../../src/ui/modals/DecisionModal.tsx), [src/ui/screens/GameScreen.tsx:114-115](../../src/ui/screens/GameScreen.tsx), [src/ui/views/InboxView.tsx:63](../../src/ui/views/InboxView.tsx), [src/store/gameStore.ts:112](../../src/store/gameStore.ts)

**Description.** The game menu and the handbook pause the game when they open. The decision dialog doesn't. While a player reads a decision, `useGameLoop` keeps advancing days. Pending decisions, including the one on screen, can pass their deadline. The default choice then applies, along with the indecision penalty (−2.5, or −7 approval for critical events, for 180 days). Critical disasters give only 10 days, which is 2.5 seconds at 4×. The alert bar's **Review** button also opens `waiting[0]`, the oldest decision, rather than the most urgent one.

**Steps to reproduce** (browser):

1. Raise a 10-day critical event (`cyclone`, South) while another decision is waiting.
2. Resume at 2×, then click **Review** in the alert bar.
3. Leave the dialog open for about 6 seconds.

**Expected.** Time stops while a decision is on screen, or at least the decision on screen can't expire.

**Actual.** The date moved from 17 Jan to 28 Jan with the dialog open, and its countdown went from "Decide within 30 days" to "25 days". Meanwhile the cyclone decision lapsed ("Cyclone approaches the South: no decision") and a −7 "Seen as indecisive in a crisis" modifier was added.

**Suggested fix.** Pause when a decision dialog opens, as the menu and handbook already do, and resume at the previous speed when it closes. Make **Review** open the decision with the nearest deadline.

---

<a id="def-04"></a>

## DEF-04: An anti-corruption inquiry lands on whoever holds the post when it ends, not on the minister it was opened against

- **Severity:** Medium
- **Location:** [src/sim/security/investigations.ts:56-58](../../src/sim/security/investigations.ts) (`resolveInvestigation`); [src/sim/commands/cabinet.ts:14](../../src/sim/commands/cabinet.ts) (`removeMinister` leaves the inquiry running)

**Description.** An `Investigation` records only the ministry. Dismissing the minister and appointing a successor leaves the inquiry running. When it ends after 60 days it looks up whoever holds the post at that point and judges that person. The "the minister had already left" branch only runs if the post is empty.

**Steps to reproduce:** open an inquiry into Health, dismiss the minister, appoint a candidate, then advance 61 days. I repeated this over seeds 1–40.

**Expected.** The inquiry closes (or reports on the former minister) and doesn't touch the newcomer.

**Actual.** In **10 of 40** seeds the new minister was "exposed" and forced to resign, with a −3 approval scandal. In the other **30** the inbox said, for example, "Investigators found nothing against Karan Bhatia. The minister is said to be unhappy about being investigated." (seed 1: the inquiry was opened against Sneha Parekh). The new minister also lost 3 loyalty.

**Suggested fix.** End or cancel the ministry's inquiry in `removeMinister`. That needs no change to the save schema. Alternatively, store the minister's id on the inquiry and close it when the id no longer matches. That changes the save shape, so it needs `SCHEMA_VERSION` 7, a migration and a golden fixture.

---

<a id="def-05"></a>

## DEF-05: An annexed country remains a full diplomatic partner

- **Severity:** Medium
- **Location:** [src/sim/diplomacy/treaties.ts:154](../../src/sim/diplomacy/treaties.ts) (`validateProposal`), `validateEmbassy` (line 197), `validateAid` (line 209), `validateSanctions` (line 219); [src/sim/diplomacy/world.ts:12](../../src/sim/diplomacy/world.ts) (`pickCountry`); [src/sim/diplomacy/ai.ts:220](../../src/sim/diplomacy/ai.ts) (focus AI loop); [src/ui/views/world/CountryPanel.tsx](../../src/ui/views/world/CountryPanel.tsx)

**Description.** Annexation sets `military.rivals[id].annexed = true` and folds the country's GDP and population into India. The military and intelligence code checks `annexed`. The diplomacy code never does. The country keeps its relation and incidents, its AI keeps scoring actions, events can still be about it, and the World screen still treats it as independent.

**Steps to reproduce:** declare war on Sri Lanka (Easy, seed 5), win (it took 35 days), settle with annexation, then try the diplomatic commands.

**Expected.** Every diplomatic action toward Sri Lanka is refused ("no longer exists as a separate state"), as intelligence operations already are.

**Actual.**

- `OPEN_EMBASSY`, `SEND_AID`, `PROPOSE_PACT` and `IMPOSE_SANCTIONS` were all **accepted**. `PROPOSE_TRADE` was refused only because "Sri Lanka's economy is too small".
- `pickCountry('any')` chose Sri Lanka 11 times in 2,000 draws, so diplomatic events can still be about it.
- In the game, the country panel still shows "Open embassy (₹400 cr)", three aid buttons, "Impose sanctions" and a pact button, along with "Economy $84 bn, Population 22 m".

**Suggested fix.** Add an annexed check to every diplomacy validator, to `pickCountry` and to the focus AI. End any treaties with the country on annexation. Show the annexed state in the country panel and on the map.

---

<a id="def-06"></a>

## DEF-06: Treaties with a rival that invades India stay in force for the whole war

- **Severity:** Medium
- **Location:** [src/sim/military/war.ts:121-139](../../src/sim/military/war.ts) (`startWar`)

**Description.** `breakTreatiesForWar` only runs when India declares the war. When a rival attacks, which is how the AI starts wars, its trade contracts, embassy and pending offers with India all survive. India keeps the contract's growth and customs bonuses from the country it is fighting and keeps paying embassy upkeep. The relation formula still credits the trade. The only way out is `BREAK_TREATY`, which charges India the "broke a deal" penalty even though the other side invaded.

**Steps to reproduce:** open an embassy and sign an industry contract with Bangladesh, then call `startWar(state, 'BGD', 'rival')` (the AI's path; the `__APEX__.invade` hook does the same).

**Expected.** The attacker's treaties and offers end with no penalty to India.

**Actual.** Both the `embassy` and `trade` treaties stay active, and the `economy.growth.industry +0.0019` and `economy.customs +0.025` modifiers remain. Breaking the contract by hand cut India's reputation from 60 to 54.

**Suggested fix.** In `startWar` with `declaredBy === 'rival'`, end the attacker's treaties with `endTreaty` (no penalty) and drop its pending offers.

---

<a id="def-07"></a>

## DEF-07: Accepting a foreign offer skips the treaty rules

- **Severity:** Medium
- **Location:** [src/sim/diplomacy/treaties.ts:494](../../src/sim/diplomacy/treaties.ts) (`validateOffer`); [src/sim/diplomacy/ai.ts:52](../../src/sim/diplomacy/ai.ts) (`canOffer`)

**Description.** AGENTS.md requires "one path for treaties… so nobody gets a deal the others could not". `validateOffer` checks only the trade-contract cap and whether a pact already exists. It doesn't check sanctions, war, annexation, or a second contract in the same sector, all of which `validateTrade` and `validatePact` refuse. Offers also stay open for 90 days after things change, for example after India sanctions the country.

**Steps to reproduce** (seed 21): advance until an AI trade offer arrives (it came from the UK, for tech). Impose sanctions on the UK, then accept the offer.

**Expected.** The offer is refused because India sanctions that country, as a player proposal would be.

**Actual.** `ACCEPT_OFFER` succeeded. India now has a `sanctions` treaty and a `trade` treaty with the UK at the same time, and the UK is still marked `sanctioned`. This contradicts `imposeSanctions`, which ends existing trade on purpose ("sanctions are not a half measure").

**Suggested fix.** Have `validateOffer` reuse the checks in `validateTrade` and `validatePact` (sanctioned, at war, annexed, duplicate sector). Drop a country's offers when India sanctions it or a war starts.

---

<a id="def-08"></a>

## DEF-08: Operations, inquiries and decision costs don't check the treasury

- **Severity:** Low
- **Location:** [src/sim/commands/index.ts:242-256](../../src/sim/commands/index.ts) (`LAUNCH_INVESTIGATION`, `LAUNCH_OPERATION`); [src/sim/security/investigations.ts:36](../../src/sim/security/investigations.ts); [src/sim/events/engine.ts:155](../../src/sim/events/engine.ts) (a choice's `cost`)

**Description.** Embassies, aid, the nuclear program, war mobilisation and intelligence operations are refused when the treasury can't cover them. Security operations, anti-corruption inquiries and decision choices that cost money are charged without any check, and the UI doesn't disable them. The monthly settlement then quietly borrows to cover the shortfall, so the rules are inconsistent and the player sees a negative treasury.

**Steps to reproduce:** set a Hard game's treasury to ₹1,000 crore, then issue the commands in order.

**Actual.**

| Command                             | Result                                |
| ----------------------------------- | ------------------------------------- |
| Seal the border                     | ok, treasury −₹500 cr                 |
| Raid                                | ok, −₹1,700 cr                        |
| Surveillance                        | ok, −₹2,300 cr                        |
| Inquiry (Health), Inquiry (Finance) | ok, −₹3,800 cr, then −₹5,300 cr       |
| Embassy, Aid, Nuclear program       | refused: "The treasury cannot cover…" |

**Suggested fix.** Add one affordability check and use it in `operationBlocked`, `validateInvestigation` and `RESOLVE_EVENT` (and disable choices the player can't afford). Otherwise, document that these costs may be borrowed.

---

<a id="def-09"></a>

## DEF-09: The War screen shows the enemy's true strength

- **Severity:** Low (it breaks a documented rule)
- **Location:** [src/ui/views/military/WarTab.tsx:49-51](../../src/ui/views/military/WarTab.tsx)

**Description.** AGENTS.md says: "the UI shows a rival's strength only through `strengthView()`, never from `state.military.rivals[...].strength`." The war card computes "Enemy army left" from `rival.strength / war.enemyStartStrength` and labels each front with odds from `frontOdds()`, which uses the enemy's true front power. Together with India's known strength, this gives away the exact figures that recon and the intelligence budget are supposed to estimate.

**Suggested fix.** Base the war card on `strengthView()` (ranges whose accuracy depends on intelligence), and show front odds as bands built from the estimate.

---

<a id="def-10"></a>

## DEF-10: The sanctions customs penalty has no floor, so customs revenue can go negative

- **Severity:** Low
- **Location:** [src/sim/diplomacy/treaties.ts:313](../../src/sim/diplomacy/treaties.ts) (`signTreaty`, sanctions branch); `multiplierFor` in [src/sim/engine/modifiers.ts](../../src/sim/engine/modifiers.ts)

**Description.** Each sanction India imposes adds `−0.0008 × the target's power` to the customs multiplier. `validateSanctions` sets no limit, and neither the modifier stack nor `projectMonth` clamps the result, so the multiplier can drop below zero.

**Steps to reproduce:** impose sanctions on the most powerful countries one by one.

**Actual.** After 20 sanctions, projected customs revenue was **−₹504 crore a month**, shown as a negative revenue line in the budget.

**Suggested fix.** Clamp the customs multiplier at 0 (or cap the total sanctions penalty) in `projectMonth`.

---

## Other findings (outside the top 10)

- **The AI's random draws vary.** In [ai.ts:142](../../src/sim/diplomacy/ai.ts), `performAction('offerDeal')` draws one extra random value, and only when a nation actually makes an offer. That shifts the rolls of every focus nation after it in the same month. It breaks the AGENTS.md rule that "AI nations draw the same number of random values per nation every month". The game is still deterministic.
- **Difficulty is checked directly.** [nuclear.ts:263](../../src/sim/military/nuclear.ts) and [NuclearTab.tsx:126](../../src/ui/views/military/NuclearTab.tsx) compare `meta.difficulty === 'hard'` instead of reading a rule from `rulesFor()`.
- **An event edits relations directly.** The `worldRelation` effect in [effects.ts:171](../../src/sim/events/effects.ts) writes `relation` for each country instead of calling `adjustRelation()`.
- **Two systems pull border tension toward different targets.** [terror.ts:47](../../src/sim/systems/terror.ts) pulls it toward 30 and [military.ts:54](../../src/sim/systems/military.ts) pulls it toward `tensionTarget()`, so the explanation and the value can disagree.
- **Inbox entries can follow the game-over entry.** Systems that don't check `status` keep running for the rest of the tick on which the game ends. For example, "New cabinet candidates" is posted after "Re-elected" or "Voted out".
- **Electron hardening.** [main.ts:16](../../electron/main.ts) reads `VITE_DEV_SERVER_URL` in packaged builds too, and lines 62 and 120 trust that origin by prefix match with no trailing slash (`http://localhost:5173` also matches `http://localhost:5173.example`).
- **The desktop autosave fallback only checks for valid JSON.** In [saves.ts:59](../../electron/saves.ts), an autosave that parses but fails its checksum isn't skipped in favour of `autosave-1`.
- **A trade treaty from an event would have no terms.** The schema allows a `treaty` event effect of kind `trade`, but it would create a contract with no sector or value. No content uses it yet.

# Phase 7: Apex, Beyond Parity & Mobile (Backlog)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 6](phase_6_polish_release.md)

**Phase goal:** make _India: Apex Sovereign_ clearly better than the mobile genre, then ship it to phones.
This is a **prioritised backlog**, not yet sprinted. Phase 8 (v2.0) already delivered some of it; those rows are marked. After launch, it is re-ranked with player feedback and split into 2-week sprints (7.1, 7.2, …).

---

## Epic A: Mobile release (Android first, then iOS)

| ID  | Item                                                                                                                        | Est. SP |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------- |
| A1  | Capacitor wrapper; phone-width layout, safe areas and touch targets; Android back button and app lifecycle                  | 5       |
| A2  | Save storage on the device (Capacitor Filesystem); settings stay in the WebView's storage                                   | 2       |
| A3  | Performance: pause and autosave when the app goes to the background (in 7.1); a Web Worker only if a low-end phone stutters | 3       |
| A4  | Play Store listing (Google Play developer account, one-time fee), privacy policy, content rating                            | 2       |
| A5  | App Store build (needs a Mac or cloud macOS CI, Apple Developer Program yearly fee), TestFlight beta                        | 5       |
| A6  | Monetisation decision: paid upfront **or** a free demo with a one-time full unlock. **No ads, no pay-to-win.**              | 1       |

### Sprint 7.1: Android app (reviewed 4 Nov 2026, about 8 SP)

**Goal:** the same game, installable on an Android phone as a debug build from CI, playable one-handed at phone width. No store listing yet (that is Sprint 7.2).

**What the review found and changed**

| Finding                                                                                                       | Change to the plan                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The simulation takes about 0.12 ms per game day on a desktop; a five-year save is about 84 KB                 | A3's Web Worker is **not needed for launch**. Pausing in the background covers battery; profile on a real phone before moving the sim |
| The layout already collapses to a bottom tab bar at 768 px, but nothing is tested at phone width (375–412 px) | Add a phone e2e project (412 × 915, touch) and fix what it finds                                                                      |
| No safe-area handling, no Android back button, no pause when the app is backgrounded                          | Part of A1                                                                                                                            |
| "Why?" tooltips open on focus, so a tap works; they can run off the left edge of a phone                      | Keep them, and keep them on screen                                                                                                    |
| Preferences are read synchronously at start-up and are best-effort                                            | Settings stay in the WebView's `localStorage`; only **saves** move to Capacitor Filesystem (A2)                                       |
| This machine has no Android SDK                                                                               | CI builds the APK (GitHub's Ubuntu runners have the SDK); local builds stay optional                                                  |

**Decisions**

| Question            | Decision                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Framework           | **Capacitor 8** around the same Vite build, as the master plan says. No separate mobile UI             |
| App id              | `io.github.munna7862.apexsovereign` (changeable until the first Play Store upload)                     |
| Minimum Android     | Capacitor 8's default (Android 7.0, API 24)                                                            |
| Orientation         | Portrait and landscape both allowed                                                                    |
| Where saves live    | The app's private data folder, written to a temporary file and renamed, like the desktop               |
| Build output in 7.1 | An unsigned debug APK as a CI artifact on every PR. Signed release builds wait for the keystore in 7.2 |

**Scope**

| Item | Work                                                                                                                                | SP  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | --- |
| 7.1a | Capacitor project (`capacitor.config.ts`, `android/`), app icon and splash from `build/icon.png`, `npm run android:*` scripts       | 2   |
| 7.1b | `src/platform/mobile.ts`: Filesystem save storage, the shell (quit = exit app), back button, pause and autosave on background       | 2   |
| 7.1c | Phone layout: `viewport-fit=cover` and safe-area insets, 44 px touch targets on coarse pointers, tooltips kept on screen            | 2   |
| 7.1d | Tests: unit tests for the mobile storage and back-button logic (mocked plugins); a `@phone` e2e project; CI job that builds the APK | 2   |

**Acceptance**

- [x] `npm run verify` passes, including the new phone e2e project
- [ ] CI builds `app-debug.apk` on every PR and uploads it as an artifact
- [ ] On a phone: a new game, a save, closing the app and Continue all work; the back button closes dialogs, then returns to the dashboard, then leaves the app from the main menu
- [x] Nothing overflows sideways at 412 px; every button is at least 44 px tall on touch screens
- [x] The desktop and browser builds are unchanged

### Sprint 7.2: Play Store (after 7.1, needs the owner)

A4 and A6: decide the price model, create the Google Play developer account and the upload keystore (kept out of the repository, in GitHub secrets), a release workflow that builds a signed AAB, a privacy policy (the game collects nothing), the content rating and the listing.

## Epic B: Indian democracy depth (the big differentiator)

| ID  | Item                                                                                                                                                    | Est. SP |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| B1  | Parliament: Lok Sabha and Rajya Sabha seat model; bills need votes; coalition partners with demands                                                     | 8       |
| B2  | Elections: fictional parties, campaigns, manifestos and an exit-poll screen; the five-year re-election vote already exists (Phase 6, `systems/term.ts`) | 8       |
| B3  | States & UTs: the 28 states and 8 UTs with their own economy, unrest and governments; Centre–state relations                                            | 13      |
| B4  | Judiciary: the Supreme Court can strike down unconstitutional policies                                                                                  | 3       |

## Epic C: Deeper economy

| ID  | Item                                                                                                                    | Est. SP |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| C1  | RBI and monetary policy: repo rate, inflation targeting, currency (₹) exchange rate                                     | 5       |
| C2  | ~~Infrastructure projects~~: **done in Phase 8** (Construction and Energy screens)                                      | —       |
| C3  | Welfare schemes: designable schemes with a target group, cost and leakage                                               | 5       |
| C4  | ~~Energy mix~~: **done in Phase 8** (six plant types, national grid, pollution); oil imports and energy security remain | 2       |

## Epic D: Living world & storytelling

| ID  | Item                                                                                             | Est. SP |
| --- | ------------------------------------------------------------------------------------------------ | ------- |
| D1  | News and media system: headlines react to your decisions; media freedom trade-offs               | 5       |
| D2  | Causal event chains: monsoon failure → farm distress → protests → election swing                 | 5       |
| D3  | Advisors who give conflicting recommendations; builds on the single Phase 8 advisor (`advise()`) | 3       |
| D4  | Achievements and scenario mode (e.g. "1991 balance-of-payments crisis", fictionalised)           | 5       |

## Epic E: Platform & community

| ID  | Item                                                                   | Est. SP |
| --- | ---------------------------------------------------------------------- | ------- |
| E1  | Hindi localisation (then Tamil, Bengali, Telugu, Marathi…)             | 5       |
| E2  | Modding: load user content JSON packs (events, departments, countries) | 5       |
| E3  | Steam release: Steamworks, achievements, cloud saves                   | 5       |
| E4  | Cloud save sync across PC and mobile                                   | 5       |

---

## Prioritisation rule

1. Mobile (Epic A) and Hindi (E1) come first: they give the biggest reach for an India-themed game. Sprint 7.1 (Android) is under way.
2. Then B1 and B2 (Parliament and elections), the strongest gameplay differentiator over the reference game.
3. Everything else is ranked by player feedback after launch.

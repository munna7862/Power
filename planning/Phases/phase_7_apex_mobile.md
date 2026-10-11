# Phase 7: Apex, Beyond Parity & Mobile (Backlog)

> [Planning index](../README.md) · [Master plan](../Master/master_plan.md) · [← Phase 6](phase_6_polish_release.md)

**Phase goal:** make _India: Apex Sovereign_ clearly better than the mobile genre, then ship it to phones.
This is a **prioritised backlog**, not yet sprinted. After v1.0 ships, it is re-ranked with player feedback and split into 2-week sprints (7.1, 7.2, …).

---

## Epic A: Mobile release (Android first, then iOS)

| ID  | Item                                                                                                           | Est. SP |
| --- | -------------------------------------------------------------------------------------------------------------- | ------- |
| A1  | Capacitor wrapper; touch-friendly hit targets; bottom-tab layout polish                                        | 5       |
| A2  | Storage adapter for Capacitor (Filesystem / Preferences)                                                       | 2       |
| A3  | Performance: run the simulation in a Web Worker; battery-friendly tick throttling                              | 3       |
| A4  | Play Store listing (Google Play developer account, one-time fee), privacy policy, content rating               | 2       |
| A5  | App Store build (needs a Mac or cloud macOS CI, Apple Developer Program yearly fee), TestFlight beta           | 5       |
| A6  | Monetisation decision: paid upfront **or** a free demo with a one-time full unlock. **No ads, no pay-to-win.** | 1       |

## Epic B: Indian democracy depth (the big differentiator)

| ID  | Item                                                                                                             | Est. SP |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| B1  | Parliament: Lok Sabha and Rajya Sabha seat model; bills need votes; coalition partners with demands              | 8       |
| B2  | Elections: general elections every 5 years with fictional parties, campaigns, manifestos and an exit-poll screen | 8       |
| B3  | States & UTs: the 28 states and 8 UTs with their own economy, unrest and governments; Centre–state relations     | 13      |
| B4  | Judiciary: the Supreme Court can strike down unconstitutional policies                                           | 3       |

## Epic C: Deeper economy

| ID  | Item                                                                                | Est. SP |
| --- | ----------------------------------------------------------------------------------- | ------- |
| C1  | RBI and monetary policy: repo rate, inflation targeting, currency (₹) exchange rate | 5       |
| C2  | Infrastructure projects: highways, rail, ports, power plants (multi-year builds)    | 5       |
| C3  | Welfare schemes: designable schemes with a target group, cost and leakage           | 5       |
| C4  | Resources and energy mix: coal, oil imports, renewables, energy security            | 5       |

## Epic D: Living world & storytelling

| ID  | Item                                                                                   | Est. SP |
| --- | -------------------------------------------------------------------------------------- | ------- |
| D1  | News and media system: headlines react to your decisions; media freedom trade-offs     | 5       |
| D2  | Causal event chains: monsoon failure → farm distress → protests → election swing       | 5       |
| D3  | Advisors who give conflicting recommendations (with competence-weighted accuracy)      | 3       |
| D4  | Achievements and scenario mode (e.g. "1991 balance-of-payments crisis", fictionalised) | 5       |

## Epic E: Platform & community

| ID  | Item                                                                 | Est. SP |
| --- | -------------------------------------------------------------------- | ------- |
| E1  | Hindi localisation (then Tamil, Bengali, Telugu, Marathi…)           | 5       |
| E2  | Modding: load user content JSON packs (events, ministers, countries) | 5       |
| E3  | Steam release: Steamworks, achievements, cloud saves                 | 5       |
| E4  | Cloud save sync across PC and mobile                                 | 5       |

---

## Prioritisation rule

1. Mobile (Epic A) and Hindi (E1) come first: they give the biggest reach for an India-themed game.
2. Then B1 and B2 (Parliament and elections), the strongest gameplay differentiator over the reference game.
3. Everything else is ranked by player feedback after v1.0.

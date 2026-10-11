# itch.io store page (copy for the hobby launch)

Paste these fields into the itch.io project editor. Pricing: **free or pay what you want** (Sprint 6.3 plan). The release workflow pushes builds automatically once `BUTLER_API_KEY` (secret) and `ITCH_TARGET` (repository variable, e.g. `yourname/india-apex-sovereign`) are set; until then, upload the files from the GitHub release by hand.

## Basics

| Field             | Value                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Title             | India: Apex Sovereign                                                                    |
| Project URL       | `india-apex-sovereign`                                                                   |
| Short description | Rule India as President in a realistic political strategy game. No ads, no paywalls.     |
| Classification    | Games                                                                                    |
| Kind of project   | Downloadable                                                                             |
| Release status    | Released                                                                                 |
| Pricing           | No payments / donations (or pay what you want, suggested ₹0)                             |
| Genre             | Strategy                                                                                 |
| Tags              | strategy, simulation, politics, management, singleplayer, economy, grand-strategy, india |
| Platforms         | Windows, macOS, Linux                                                                    |
| Community         | Comments (the feedback channel for v1.0)                                                 |
| Cover image       | `docs/screenshots/phase-6/dashboard-election.png` cropped to 630 × 500                   |
| Screenshots       | the nine images in `docs/screenshots/phase-6/`, plus `docs/release/trailer.gif`          |

## Description

> **You are the President of India. Every rupee, minister, crisis, treaty and soldier is your call, and in five years the voters decide.**
>
> _India: Apex Sovereign_ is a realistic national strategy game. Balance the budget, appoint a cabinet, steer the economy, keep the peace at home, command the armed forces and lead on the world stage, then win the election with 55% approval while voter fatigue builds year after year.
>
> **Run the country.** Five economic sectors, four taxes, eleven ministries and a cabinet of fictional ministers with competence, loyalty and corruption of their own.
>
> **Survive the job.** More than 140 events: floods and cyclones, scandals, protests, terror plots, coups. Every decision lists exactly what it will do.
>
> **Command the forces.** Twelve unit types, research, drills, espionage, wars and a nuclear programme.
>
> **Lead on the world stage.** 205 countries on an interactive map, trade contracts, pacts, embassies, aid and sanctions, and twenty AI nations that make their own moves.
>
> **See why.** Every number has a "Why?" tooltip built from the same formula the game uses, and the in-game "Constitution" handbook explains them all.
>
> **Play your way.** Easy, Normal or Hard; optional no-wars and no-riots modes; a guided tutorial; full keyboard play; interface sizes up to 150%; a colour-blind-safe palette; reduced motion.
>
> **Fair play.** No ads, no in-app purchases, no paid shortcuts. Everyone, every party and every group in the game is fictional; countries are real and treated with the same neutral rules. India's boundaries are shown as per the Survey of India.

## Install instructions

> **Windows:** run the installer, or unzip the portable build and start `India Apex Sovereign.exe`. SmartScreen may warn because the build is not signed yet: choose "More info" → "Run anyway".
>
> **macOS:** open the `.dmg` and drag the game to Applications. The first time, right-click it and choose **Open**.
>
> **Linux:** make the `.AppImage` executable (`chmod +x`) and run it.
>
> Saves are kept in your user folder and survive updates.

## Before going live (checklist)

- [ ] Create the project as a draft and upload the builds (or set the secrets and push the `v1.0.0` tag)
- [ ] Add the cover, screenshots and trailer GIF
- [ ] Turn on comments as the feedback channel
- [ ] Preview the page on a phone and a desktop, then set it to Public

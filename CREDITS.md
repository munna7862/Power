# Credits and licences

_India: Apex Sovereign_ is an original work. Its name, art, text, user interface and sound were made for this project. It is inspired by the mobile country-simulator genre but copies none of the reference game's assets, text, icons, layouts or sounds (master plan §1.3).

## Audio

All music and sound effects are **synthesised at runtime** in code (`src/ui/audio/engine.ts`) with the Web Audio API: oscillators, filters and envelopes playing original patterns on a pentatonic scale. The game ships **no audio files**, so there are no third-party audio licences.

## Art

- The app icon and favicon (`public/favicon.svg`, rendered to `build/icon.png` by `tools/release/icon.ts`) are original.
- Minister portraits are drawn procedurally in code (`src/ui/Avatar.tsx`).
- UI icons are original inline SVG (`src/ui/icons.tsx`).

## Data

| Data                    | Source                                                                                                                            | Licence       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| World map and countries | [Natural Earth](https://www.naturalearthdata.com/) 1:10m admin-0 countries, **India point of view**, simplified by `tools/world/` | Public domain |

India's boundaries are drawn as per the Survey of India; `tests/world/boundary.test.ts` blocks any map change that moves them.

## Typeface

| Font                                                             | Licence                   |
| ---------------------------------------------------------------- | ------------------------- |
| [Inter](https://rsms.me/inter/) (via @fontsource-variable/inter) | SIL Open Font License 1.1 |

## Software

The game is built with open-source software, all under permissive licences (MIT unless noted): React, React DOM, Zustand, Zod, i18next and react-i18next (runtime, bundled into the game); Electron (desktop shell); Vite, TypeScript (Apache-2.0), Vitest, Playwright (Apache-2.0), ESLint, Prettier, electron-builder, tsx, gifenc and pngjs (build and test tools only). Full licence texts are in each package under `node_modules/`; the desktop build includes Electron's own `LICENSE` and `LICENSES.chromium.html`.

## People

Every minister, President, militant group and organisation in the game is **fictional**. Countries are real, shown with neutral, statistics-based behaviour; no real leaders, parties or organisations appear.

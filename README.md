# Słowo dnia

**Słowo dnia** ("Word of the day") is a free web app (PWA) for learning Polish one word or phrase at a time: a kids' course (500 words, learned together with a parent) and an adult course (1000 words about life in Poland). The interface is in Russian; progress is stored only in the browser.

Open the app: https://trajgiel.github.io/Slowo-dnia/

The code here is the React + TypeScript version of the app. Until it is released, the site serves the previous version (a single page without a build step); it stays in the git history.

## Requirements

- Node 24 (see `.nvmrc`) and npm

## Run locally

```sh
npm install
npm run dev
```

Vite prints the local address; the app is served under the base path `/Slowo-dnia/` (for example http://localhost:5173/Slowo-dnia/).

## Scripts

| Command                                     | What it does                                                       |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                               | development server                                                 |
| `npm run build`                             | type check and production build into `dist/` (base `/Slowo-dnia/`) |
| `npm run preview`                           | serve the production build locally                                 |
| `npm run check`                             | everything CI runs: Prettier, ESLint, TypeScript, Vitest, build    |
| `npm run prettier` / `npm run prettier:fix` | check / fix formatting                                             |
| `npm run lint` / `npm run lint:fix`         | ESLint                                                             |
| `npm run typecheck`                         | TypeScript                                                         |
| `npm test` / `npm run test:watch`           | Vitest                                                             |

## Project layout

- `src/` — the app, split into layers; a layer imports only the layers below it (ESLint enforces this):
  - `app/` — entry, router, layout
  - `features/` — screens
  - `shared/ui/` — shared components; `state/` — store and actions
  - `storage/`, `data/`, `platform/`, `i18n/` — `localStorage`, course data, browser APIs, dictionaries
  - `domain/` — pure functions and types (no React, DOM or storage)
- `src/i18n/locales/` — interface strings; text in JSX outside the dictionaries fails `npm run lint`
- `scripts/extract-courses.ts` — one-off transfer of the course data from the prototype (`node scripts/extract-courses.ts <prototype-dir>`): writes `src/data/kidsCourse.ts`, `src/data/adult.json` and the test fixture `src/test/fixtures/prototype-courses.json`
- `public/` — files published as is: `icons/`, `fonts/` (with their licenses), `LICENSE`
- `.github/workflows/` — CI (`ci.yml`) and the pull request direction check (`pr.yml`)

## Branches

Task branches go into `develop` via pull request; `develop` goes into `main` on release. GitHub Pages publishes `main`.

## Copyright

© 2026 [Wlodzimierz Trajgiel](https://www.linkedin.com/in/trajgiel/). All rights reserved.

Copying, modifying or distributing the app or its parts (code, texts, word lists, design, icons) without the author's written permission is prohibited. See [`LICENSE`](public/LICENSE). The fonts in `public/fonts/` do not belong to the author and are distributed under the SIL Open Font License 1.1.

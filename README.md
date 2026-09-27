# Learning Adventures 🎈

An interactive learning app for kids ages 4–8. Pick a profile, choose an age level, and practice letters, counting, shapes, math, English, or science through short, click-to-answer worksheets — with a progress dashboard for each kid.

**Live app:** https://januz06.github.io/WebApp/

## Features

- **Profiles** — each kid gets their own name and a cute animal avatar (🐶🐱🦊🐼🦁🦄 and more).
- **Two age levels**
  - *Little Learners (4–6):* Letters, Counting, Shapes & Colors, Math Basics
  - *Elementary (6–8+):* Math, English, Science — each with **Easy / Medium / Hard** difficulty
- **Instant feedback** — click an answer, see it marked right or wrong immediately.
- **Progress dashboard** — worksheets completed, overall accuracy, per-subject accuracy bars, and recent session history.
- **Installable** — works as a home-screen app on both iOS and Android (see below).
- **Fully offline-capable** — no backend, no account, no tracking. All data is saved in the browser's local storage on that device.
- **Responsive** — adapts to phone, tablet, and desktop screens, with light/dark mode support.

## Installing on a phone or tablet

**iOS (Safari):**
1. Open the live app link in Safari.
2. Tap the **Share** icon → **Add to Home Screen**.

**Android (Chrome):**
1. Open the live app link in Chrome.
2. Tap the **⋮** menu → **Add to Home Screen** / **Install app**.

Once installed, it opens full-screen with its own icon, just like a regular app.

## Hosting it yourself (GitHub Pages)

This repo is a single self-contained `index.html` file — no build step, no dependencies to install.

1. Push/upload `index.html` to the repo root.
2. Go to **Settings → Pages**.
3. Set **Source** to the `main` branch, folder `/ (root)`, and save.
4. GitHub publishes it at `https://<your-username>.github.io/<repo-name>/` within about a minute.

## Data & privacy

- Profiles and progress are stored only in `localStorage` in the browser on each device — nothing is sent to a server.
- Data does **not** sync between devices; each phone/tablet/browser keeps its own save.
- Clearing that browser's site data/storage will erase saved profiles and progress.
- Because GitHub Pages repos are public, anyone with the link can open the app (though their data stays local to their own device).

## Tech

Plain HTML, CSS, and vanilla JavaScript in one file. Uses Google Fonts (Baloo 2, Nunito) for styling — everything else is self-contained and works offline once loaded.

## Customizing

All content lives in `index.html`:
- `SUBJECTS` — subject definitions and question builders
- `AGE_GROUPS` — which subjects appear at which age level
- `ENGLISH_POOL` / `SCIENCE_POOL` — question banks, tagged by difficulty (`easy` / `medium` / `hard`)
- `ANIMAL_AVATARS` — the list of avatar emoji

Edit these arrays/objects to add questions, subjects, or avatars.

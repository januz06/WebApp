# Learning Adventures 🎈

An interactive learning app for kids ages 4–8. Pick a profile, choose an age level, and practice letters, counting, shapes, math, English, and science through short, click-to-answer worksheets.

Live app: https://januz06.github.io/WebApp/

## Features

- Profiles — each child gets their own name and a cute animal avatar.
- Two age levels
  - Little Learners (4–6): Letters, Counting, Shapes & Colors, Math Basics
  - Elementary (6–8+): Math, English, Science, and other practice topics with Easy / Medium / Hard difficulty
- Instant feedback — tap an answer and it is marked right or wrong immediately.
- Progress dashboard — worksheets completed, accuracy, recent history, and per-subject progress.
- Smooth repeated-session play — question generation respects the profile’s answered history so kids see less repetition over time.
- Installable — works as a home-screen app on both iOS and Android.
- Offline-capable — all data is stored in the browser local storage on that device.
- Responsive — works on phone, tablet, and desktop screens.

## Installing on a phone or tablet

### iOS (Safari)
1. Open the live app link in Safari.
2. Tap the Share icon → Add to Home Screen.

### Android (Chrome)
1. Open the live app link in Chrome.
2. Tap the ⋮ menu → Add to Home Screen / Install app.

Once installed, it opens full-screen with its own app icon.

## Hosting it yourself (GitHub Pages)

This repo is a self-contained static app with no build step.

1. Push the repo to GitHub.
2. Go to Settings → Pages.
3. Set Source to the main branch and root folder.
4. GitHub publishes it at `https://<your-username>.github.io/<repo-name>/`.

## Data & privacy

- Profiles and progress are stored only in `localStorage` in the browser on each device.
- Data does not sync between devices.
- Clearing browser storage will erase saved profiles and progress.
- Because GitHub Pages repos are public, anyone with the link can open the app, although their saved data stays local to that browser/device.

## Tech

Plain HTML, CSS, and vanilla JavaScript. Uses Google Fonts for styling and is self-contained for offline use after initial load.

## Customizing

All content lives in the app source files:
- `SUBJECTS` — subject definitions and question builders
- `AGE_GROUPS` — which subjects appear at each age level
- `ENGLISH_POOL` / `SCIENCE_POOL` — question banks tagged by difficulty
- `ANIMAL_AVATARS` — avatar choices for profile creation

The app also tracks a per-profile `answeredQuestions` list so repeated sessions feel more varied while still keeping the gameplay simple and fast.

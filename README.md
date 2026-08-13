# HUMAN VERIFICATION

Live release: [areuhuman.netlify.app](https://areuhuman.netlify.app)

HUMAN VERIFICATION is a production touchscreen skill game for supervised carnival and kiosk use. A subject completes short interaction, memory, timing, and logic tests while compatible conditions accumulate across the session. Results come from measured input - including timing error, contact delta, path drift, precision error, reaction time, velocity, and completion time - rather than fabricated near misses or random outcomes.

The shipped catalog contains 54 playable variants across 44 mechanics and 12 persistent conditions. It includes adaptive difficulty, lives and response chains, local leaderboards and statistics, deterministic prize thresholds, operator playtesting, hardware touch diagnostics, procedural Web Audio, and an offline-capable PWA shell.

Everything required for play is local and client-side. There is no account, API, database, paid service, remote media, analytics requirement, or core network dependency.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the Vite address on the target display. The first launch opens terminal commissioning; those settings remain editable in the operator panel.

Build and inspect the production bundle with:

```bash
npm run build
npm run preview
```

The static production output is written to `dist/`.

## Netlify deployment

This repository is configured for Netlify through `netlify.toml` and `public/_redirects`:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`
- Environment variables: none
- SPA fallback: all application routes return `index.html`
- Hashed assets: one-year immutable cache headers

Connect the repository to Netlify and deploy. For a manual deployment, run `npm run build` and upload the resulting `dist/` directory. The production site is currently deployed at [https://areuhuman.netlify.app](https://areuhuman.netlify.app).

## Operator workflow

From standby, press and hold the HUMAN VERIFICATION title for four seconds, then enter the local PIN. `Ctrl+Shift+A` opens the same PIN prompt while the standby screen is active.

- Default development PIN: `9900`
- The PIN can be changed in the operator controls.
- It is convenience protection for a supervised machine, not secure authentication.

The operator panel controls service availability, free play and attempts, tolerance, difficulty, persistent conditions, identity and booth copy, deterministic prize bands, leaderboard policy, blocked names, audio buses, display scaling, fullscreen, timeouts, effects, exports, and local record clearing.

### Playtest

The **PLAYTEST** tab exposes every variant at easy, medium, and hard difficulty. Operators can choose a deterministic seed, force compatible conditions, repeat the last test, inspect raw measured results, and enable FPS/state or detailed contact instrumentation. A playtest updates balancing statistics but does not create a leaderboard entry.

### Touch Check

The **TOUCH CHECK** tab is an application-level hardware diagnostic. Run it on the installed touchscreen before opening the booth. It checks four inset corners, the center sensor, and two concurrent touch contacts while displaying active pointer IDs, contact size, pressure, capture state, and a bounded event log.

The check confirms Pointer Events received by the browser; it does not change operating-system calibration. Mouse and pen activity remains visible but cannot complete touch-only checks.

## Booth setup

1. Prefer a landscape 16:9 touchscreen at 1366 x 768 or 1920 x 1080.
2. Load the production site successfully once while online, then verify a reload with the network disabled.
3. Run **TOUCH CHECK**, followed by representative easy, medium, and hard Playtest runs.
4. Test simultaneous contact, hold, drag, swipe, trace, pointer cancellation, and edge areas on the real hardware. A mouse cannot validate multi-touch.
5. Enter fullscreen or install the PWA. Use the browser's kiosk mode if operating-system chrome and shortcuts must be restricted.
6. Disable OS edge-swipe navigation or other reserved touch gestures when the device permits it.
7. Touch the display once to unlock browser audio, then confirm master, music, and SFX levels.

Fullscreen and wake lock require user interaction and may be restricted or revoked by browser or battery policy. Gameplay continues if either capability is unavailable.

## Gameplay and measured feedback

Each run progresses from intake to subject initialization, a sequence of fair touch-first tests, measured response feedback, and a final verification report. Sessions end after the configured completion limit or when tolerance is exhausted. A second subject always starts with clean transient input, timers, conditions, audio state, and session data.

Feedback reports real captured measurements when the mechanic provides them. The 99% acceptance path is staged as a verification sequence and does not alter the score, manufacture a prize, or imply a near miss that did not occur.

The 12 persistent conditions use explicit compatibility rules so every active combination remains possible. Difficulty scales through target size, sequence length, tolerance, movement, and response windows rather than speed alone.

## Local data and privacy

Settings, leaderboard entries, aggregate run data, personal bests, and per-variant statistics are stored in the browser under the versioned key:

```text
human-verification:data:v1
```

Legacy HUMAN VERIFICATION installations migrate automatically. The only player-provided personal data is the optional local leaderboard name, which is sanitized before storage. JSON and CSV exports are initiated by the operator and remain local unless the operator moves them elsewhere.

Clearing this site's browser storage resets settings, scores, statistics, and first-run commissioning.

## Offline and PWA behavior

Production builds register `public/sw.js`; development mode intentionally does not. Service-worker cache v3 (`human-verification-v3`) precaches the application shell, manifest, local icon/social image, and hashed build assets. Navigations are network-first with an offline shell fallback, while same-origin assets are cache-first and never receive HTML as an error fallback. New releases activate and claim an open kiosk immediately.

Offline use begins after one successful production load. For a material release, increment the `CACHE` name in `public/sw.js` so activation removes the previous cache. If a booth still displays an old release, reload once online; clear the browser cache only when necessary. Clearing all site data also removes local operator settings and records.

All sound is generated at runtime with original Web Audio oscillators, filtered relay noise, long-lived music/SFX buses, and a layered diagnostic ambience. No audio files or remote assets are downloaded during play.

## Project map

- `src/App.tsx` - screen state machine, subject session lifecycle, scoring integration, persistence, and transitions
- `src/game/challenges/catalog.ts` - canonical 54-variant catalog across 44 mechanics
- `src/components/challenges/` - interaction, memory, and logic runtimes plus global pointer/rule enforcement
- `src/game/engine/` - pure scoring, selection, adaptive difficulty, and pointer geometry
- `src/game/rules/rules.ts` - the 12 persistent conditions, compatibility, activation, and expiry
- `src/storage/store.ts` - versioned local storage, leaderboards, statistics, and clean sessions
- `src/audio/audio.ts` - original procedural Web Audio system
- `src/components/AdminPanel.tsx` - operator settings, Playtest, Touch Check access, statistics, and exports
- `public/` and `netlify.toml` - PWA shell, service worker, SPA redirect, and Netlify release configuration

## Verification checks

Run all required automated checks before release:

```bash
npm test
npm run lint
npm run build
```

The suite covers catalog integrity, scoring, prize thresholds, adaptive selection, condition compatibility and expiry, pointer geometry, simultaneous input, trace validation, leaderboard ordering, persistence recovery, metric aggregation, and clean session creation.

Before publishing, also test the production preview through the complete flow: commissioning/defaults, intake, successes, failure with remaining tolerance, zero-tolerance ending, completion-limit ending, qualifying name entry and skip, results, today/all-time records, second-subject reset, settings applied to the next run, every variant at all tiers, forced compatible conditions, Touch Check, fullscreen, visibility pause, audio unlock/mute, export, reload persistence, and offline reload.

## Reference research and provenance

The design and engineering review is documented in [docs/reference-research.md](docs/reference-research.md). External projects were studied only for general interaction and architecture principles.

No third-party code, assets, text, sounds, challenge sequences, or visual identity were reused. The current research pass therefore requires no third-party notice file or attribution entry. Any future direct reuse requires a fresh license review at a pinned revision and the appropriate copyright, permission, and notice handling before it can ship.

## Troubleshooting

### Touch scrolls, zooms, or loses an edge gesture

Gameplay uses Pointer Events, pointer capture, cancellation cleanup, disabled selection, and touch-action controls. If the OS intercepts a gesture before the browser receives it, disable that OS gesture or use kiosk mode.

### Multi-touch fails with a mouse or trackpad

Use a real multi-touch display. A mouse supplies only one pointer and cannot validate simultaneous tap, hold-and-tap, finger replacement, Finger Twister, or other multi-contact mechanics.

### There is no sound

Touch the game once to unlock browser audio, check operator mute and all three volume controls, and confirm the operating-system output device.

### The old release remains visible

Reload while online and confirm the service-worker cache name was incremented for the release. Clear the browser cache only if needed; clearing all site data also resets local game data.

### The terminal must be reset

Use operator controls for targeted record/statistics clearing, or clear the site's browser storage to return to first-run commissioning.

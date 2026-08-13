# Repository guide

## Product contract

This is a real carnival game, not a static demo. Every visible control must work. Changes must preserve complete start-to-result gameplay, clean reset between players, measurable/fair failure feedback, local persistence, operator controls, touch input, offline production behavior, and Netlify static deployment.

Do not add placeholders, fake leaderboard data, fabricated near misses, random prize outcomes, paid APIs, copyrighted media, or a core network dependency.

## Architecture

- `src/App.tsx`: screen state machine, session lifecycle, transitions, credits, leaderboard qualification, and integration.
- `src/game/challenges/catalog.ts`: the canonical 40-item challenge metadata catalog.
- `src/components/challenges/`: three runtime groups. `ChallengeArena` owns the countdown, global pointer/rule enforcement, visibility pause, touch visualizer, and PIX side rule. Interaction, memory, and logic components implement the mechanics.
- `src/game/engine/`: pure scoring, selection/adaptive difficulty, and pointer geometry.
- `src/game/rules/rules.ts`: compatibility, activation, expiration, and input modification for persistent rules.
- `src/storage/store.ts`: versioned localStorage, leaderboard ordering, challenge statistics, and clean session creation.
- `src/audio/audio.ts`: original procedural Web Audio cues and ambience.
- `src/components/AdminPanel.tsx`: operator settings, challenge browser, stats, and exports.
- `src/styles/`: global identity plus screen, challenge, and admin styles.
- `public/`: PWA manifest, service worker, icon, and Netlify SPA redirect.
- `netlify.toml`: Netlify build, publish, redirect, and security/cache headers.

## Challenge contract

Every `ChallengeDefinition` requires a unique `id` and `kind`, a category, gesture family, short instruction, minimum round, fair time limit, accessibility text, and any incompatible persistent rules. Its runtime must:

1. Render a readable touch-first task.
2. Accept Pointer Events and cleanly handle pointer cancel where contact persists.
3. Call `onResult` exactly once with a real success/failure, accuracy, plain-language message, and measured detail where applicable.
4. Scale at easy/medium/hard through target size, sequence length, tolerance, movement, or response window—not speed alone.
5. Remain possible with every compatible active rule.
6. Work with the admin challenge browser.

If adding a challenge, update the catalog/runtime, keep instruction copy brief, add a catalog test, and manually test it on a touchscreen.

## Code conventions

- TypeScript is strict; keep engine math and persistence logic pure and tested.
- React components own visual/runtime state. Do not introduce global mutable game state.
- Use Pointer Events instead of separate mouse/touch code.
- Clear every timer, interval, pointer capture, audio loop, and temporary rule through React cleanup or session teardown.
- Never use hover as the only way to access a control.
- Keep normal controls finger-sized; microscopic targets belong only to explicit precision mechanics.
- Do not use `dangerouslySetInnerHTML` for player or operator data.
- Sanitize leaderboard names through `sanitizeName`.
- Keep core visuals local and code-native. Do not add remote image/font/audio dependencies.
- Preserve `netlify.toml`, the `dist` publish directory, and the static SPA redirect.

## Required checks

```bash
npm test
npm run lint
npm run build
```

Before a release, also run the production preview and test:

- defaults → start → successes → failure → remaining lives → result;
- zero lives and 32-completion session endings;
- qualifying name entry and skip-to-PLAYER;
- today/all-time leaderboard sorting;
- second player reset;
- settings affecting the next run;
- each challenge from the browser at all tiers;
- real simultaneous touches, pointer cancellation, holds, swipes, drags, and tracing;
- fullscreen, visibility pause, audio unlock/mute, export, reload persistence, and offline reload.

## Service-worker releases

Development mode intentionally does not register the service worker. For a material production update, increment the cache name in `public/sw.js` so old cached files are removed on activation.

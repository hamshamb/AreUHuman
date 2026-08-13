# External reference research

Reviewed 2026-08-12 against primary sources: repository pages, repository license/terms files, package metadata, and official project pages. This is a design/engineering study, not legal advice.

**Reuse decision:** No external code, assets, text, sounds, level sequences, or visual identity were reused. General interaction and architecture ideas must be reimplemented independently. No `THIRD_PARTY_NOTICES.md` entry is triggered by this research pass.

## 1. QuirkyLock

- **Project / URL:** [sayantanDs/quirkylock](https://github.com/sayantanDs/quirkylock)
- **License:** [MIT; copyright 2023 Sayantan Das](https://github.com/sayantanDs/quirkylock/blob/main/LICENSE).
- **Useful idea:** One folder/module per rule, a central rule list, incremental disclosure, and a visible set of requirements that remain active together.
- **Code reused:** No.
- **Attribution requirement:** None triggered. If code is later copied, retain the MIT copyright and permission notice in copies or substantial portions.
- **How AreUHuman differs:** Rules constrain short physical touchscreen challenges across a scored session; the player is not editing one password and none of QuirkyLock's rules, puzzles, UI, or assets are copied.

## 2. VibeWare

- **Project / URL:** [areibman/vibeware](https://github.com/areibman/vibeware)
- **License:** **Conflicting declarations.** [`LICENSE.md` contains MIT terms](https://github.com/areibman/vibeware/blob/main/LICENSE.md), while the [README and `package.json`](https://github.com/areibman/vibeware/blob/main/package.json) say ISC. Treat as uncertain unless the maintainer clarifies.
- **Useful idea:** Isolated microgame scenes, a registry/configuration point, transition scenes that expose score/lives/speed, validation of registered games, and responsive scaling.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Direct reuse is blocked by the MIT/ISC conflict; if clarified, preserve the applicable notice and license.
- **How AreUHuman differs:** It keeps the existing React/TypeScript challenge contract and selectively uses SVG/Canvas rather than adopting Phaser or VibeWare's scenes, prompts, games, telemetry, or art.

## 3. I'm Not a Robot (Henry Amatsu)

- **Project / URL:** [henryamatsu/im-not-a-robot](https://github.com/henryamatsu/im-not-a-robot)
- **License:** No license file or license declaration found; public visibility does not grant reuse rights.
- **Useful idea:** Begin with recognizable CAPTCHA framing, then progressively reveal that verification is the game.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Permission would be required before copying; credit alone is not permission.
- **How AreUHuman differs:** It is an offline-capable carnival score attack with rapid measurable touch tests, persistent rules, PIX, lives, operator tools, and local leaderboards—not a full-stack CAPTCHA level clone.

## 4. Kitboga Code Jam 2025 template/event

- **Project / URL:** [The-Kitboga-Show/codejam25](https://github.com/The-Kitboga-Show/codejam25)
- **License:** No public open-source license. [`TERMS.md`](https://github.com/The-Kitboga-Show/codejam25/blob/main/TERMS.md) grants broad rights from entrants to The Kitboga Show; it does not grant those rights to other users.
- **Useful idea:** Small constrained interactions, locally packaged assets, readable spectator comedy, skill over chance, eventual completable outcomes, and explicit difficulty controls.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Obtain permission for direct reuse; the submission agreement is not a public license.
- **How AreUHuman differs:** It is a full-screen, multi-round, persistent PWA/kiosk session rather than a 390×300 embedded CAPTCHA intended for a Code Jam submission.

## 5. Wes Bos Kitboga CAPTCHA

- **Project / URL:** [wesbos/Kitboga-captcha](https://github.com/wesbos/Kitboga-captcha)
- **License:** **Uncertain.** [`package.json` declares MIT](https://github.com/wesbos/Kitboga-captcha/blob/main/package.json), but no MIT license text is included and [`TERMS.md`](https://github.com/wesbos/Kitboga-captcha/blob/main/TERMS.md) is the organizer-only submission agreement.
- **Useful idea:** Data-driven target durations and tolerances, several concurrent timers, and exact early/late feedback after measured release times.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Resolve the incomplete/conflicting license evidence before reuse; if MIT is confirmed, retain its copyright and permission notice.
- **How AreUHuman differs:** Biometric calibration/charge mechanics use original terminal visuals, short arcade pacing, and truthful millisecond metrics rather than food, grilling, its timing values, music, or assets.

## 6. Crow Lifting Weights CAPTCHA

- **Project / URL:** [CourageousMayonnaise/codejam25-crow-lifting-weights](https://github.com/CourageousMayonnaise/codejam25-crow-lifting-weights)
- **License:** No public open-source license; its [`TERMS.md`](https://github.com/CourageousMayonnaise/codejam25-crow-lifting-weights/blob/main/TERMS.md) grants rights only to The Kitboga Show.
- **Useful idea:** A short ordered-input sequence with embodied animation, immediate positive feedback per step, and a clear reset animation after a mistake.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Permission is needed for code or crow imagery; credit alone is insufficient.
- **How AreUHuman differs:** It uses original geometric/PIX feedback and touch coordination metrics, not the crow, the word sequence, frames, background, or submission implementation.

## 7. Scratch-Off CAPTCHA

- **Project / URL:** [CourageousMayonnaise/codejam25-scratch-off](https://github.com/CourageousMayonnaise/codejam25-scratch-off)
- **License:** No public open-source license. The file named [`LICENSE.md`](https://github.com/CourageousMayonnaise/codejam25-scratch-off/blob/main/LICENSE.md) is the organizer-only Code Jam submission agreement, not a license to the public.
- **Useful idea:** Canvas erasure with `destination-out`, spatial coverage bins, and a completion threshold. The reference listens to mouse movement, so its input handling is not a model for robust touch.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Permission is required for code and assets.
- **How AreUHuman differs:** Original sensor-cleaning visuals use Pointer Events, pointer cancellation/capture, continuous touch paths, honest percent-cleared measurement, and no scratch-card art or GIFs.

## 8. Word Problem CAPTCHA

- **Project / URL:** [w3cj/kitboga-codejam25-word-problem-captcha](https://github.com/w3cj/kitboga-codejam25-word-problem-captcha)
- **License:** No public open-source license; [`TERMS.md`](https://github.com/w3cj/kitboga-codejam25-word-problem-captcha/blob/main/TERMS.md) grants submission rights to The Kitboga Show only.
- **Useful idea:** Separate structured problem data from evaluation logic, generate parameters, and introduce meaningful red herrings without making the solution random.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Permission is required for implementation or problem text.
- **How AreUHuman differs:** It converts the principle into glanceable 3–8 second visual logic tasks and attribute filtering, avoiding long prose, copied problem templates, and dropdown UX.

## 9. Human Benchmark clone

- **Project / URL:** [gitbeet/humanbenchmark-clone](https://github.com/gitbeet/humanbenchmark-clone)
- **License:** No license file and no license field in [`package.json`](https://github.com/gitbeet/humanbenchmark-clone/blob/main/package.json); do not copy.
- **Useful idea:** Store objective per-attempt results, show history/statistics, and separate reaction, aim, number, sequence, and visual-memory measurements.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Permission is required for any code/assets.
- **How AreUHuman differs:** Metrics feed one escalating carnival run—milliseconds, pixels, touch delta, accuracy, completion time, combo, and adaptive difficulty—with no account/cloud dependency or copied Human Benchmark presentation.

## 10. crisp-game-lib

- **Project / URL:** [abagames/crisp-game-lib](https://github.com/abagames/crisp-game-lib)
- **License:** [MIT; copyright 2022 ABA Games](https://github.com/abagames/crisp-game-lib/blob/master/LICENSE.txt).
- **Useful idea:** Very small update loops, simple geometric collision, one-input readability, procedural sound, difficulty progression, fast restart, and mobile performance discipline.
- **Code reused:** No.
- **Attribution requirement:** None triggered. If code is later copied, retain the MIT copyright and permission notice.
- **How AreUHuman differs:** It keeps React as the shell and uses its own challenge runtime, pointer geometry, Web Audio, visuals, and scoring instead of adding crisp-game-lib or copying its samples.

## 11. Claude One-Button Game Creation

- **Project / URL:** [abagames/claude-one-button-game-creation](https://github.com/abagames/claude-one-button-game-creation)
- **License:** [MIT; copyright 2026 ABA Games](https://github.com/abagames/claude-one-button-game-creation/blob/main/LICENSE.txt).
- **Useful idea:** Generate mechanically distinct games from constrained input, document each design, isolate each implementation, and browser-smoke-test every result before curation.
- **Code reused:** No.
- **Attribution requirement:** None triggered. If code is later copied, retain the MIT copyright and permission notice.
- **How AreUHuman differs:** It applies the simplicity lesson to curated 3–8 second tests inside one coherent rules/scoring system; it is not an AI batch generator and does not ship generated examples unchanged.

## 12. One-Button Game Builder

- **Project / URL:** [abagames/one-button-game-builder](https://github.com/abagames/one-button-game-builder)
- **License:** [MIT; copyright 2023 ABA Games](https://github.com/abagames/one-button-game-builder/blob/main/LICENSE.txt).
- **Useful idea:** Define input action, characters/state, score, failure, difficulty progression, and sound as separate design decisions before implementation; use limited input for timing and risk/reward.
- **Code reused:** No.
- **Attribution requirement:** None triggered. If code is later copied, retain the MIT copyright and permission notice.
- **How AreUHuman differs:** One-tap challenges are only part of a broader multi-touch, trace, drag, swipe, memory, logic, persistent-rule, and mascot system with real measured feedback.

## 13. One-Prompt Games

- **Project / URL:** [shumatsumonobu/one-prompt-games](https://github.com/shumatsumonobu/one-prompt-games)
- **License:** **Incomplete/uncertain.** [`package.json` declares ISC](https://github.com/shumatsumonobu/one-prompt-games/blob/main/package.json), but the repository has no license file or copyright/permission text.
- **Useful idea:** A broad mechanic inventory—memory matrix, rhythm judgements, dodge/near-miss play, inhibition/escalation, Web Audio cues, mobile controls, and local high scores—plus explicit state and scoring in each brief.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Resolve the missing ISC notice before reuse; if clarified, preserve its copyright and permission notice.
- **How AreUHuman differs:** It uses original short verification mechanics and art, measures actual performance, enforces cleanup/accessibility, and curates for a shared session rather than shipping unrelated one-prompt games.

## 14. Touch Games

- **Project / URL:** [TrisonWorld/touch-games](https://github.com/TrisonWorld/touch-games)
- **License:** No root license or package declaration found; the repository aggregates recognizable game implementations, so provenance and per-directory rights are also uncertain.
- **Useful idea:** Large direct-manipulation surfaces and layouts that remain playable on touchscreens. Treat the older event handling as historical reference only.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Do not copy without resolving each component's origin and license.
- **How AreUHuman differs:** It uses modern Pointer Events, multiple simultaneous pointer IDs, capture/cancel cleanup, diagnostics, and original microgames—not touch adaptations of Pac-Man, 2048, Simon, or other existing games.

## 15. LittleJS

- **Project / URL:** [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS)
- **License:** [MIT; copyright 2021 Frank Force](https://github.com/KilledByAPixel/LittleJS/blob/main/LICENSE).
- **Useful idea:** Lightweight render/update separation, pooled particles, primitive debug drawing, mobile input, procedural ZzFX-style sound, and performance-conscious Canvas/WebGL effects.
- **Code reused:** No.
- **Attribution requirement:** None triggered. If code is later copied, retain the MIT copyright and permission notice.
- **How AreUHuman differs:** It keeps the current React/SVG/Canvas architecture and original procedural Web Audio rather than adopting the engine, its API, effects, examples, or sound implementation.

## 16. Neal.fun — The Password Game

- **Project / URL:** [The Password Game](https://neal.fun/password-game/)
- **License:** Proprietary/publicly playable reference; no public source license identified.
- **Useful idea:** A familiar input that gradually reveals surprising new constraints, with prior constraints remaining visible and active.
- **Code reused:** No.
- **Attribution requirement:** None triggered. Do not copy proprietary code, exact rules, jokes, text, art, or sequence; attribution would not substitute for permission.
- **How AreUHuman differs:** Persistent rules span physical microgames and expire/compose through compatibility metadata; there is no password field and the exact escalation is original.

## 17. Neal.fun — I'm Not a Robot

- **Project / URL:** [I'm Not a Robot](https://neal.fun/not-a-robot/) and its official [embed documentation](https://neal.fun/not-a-robot/embed/)
- **License:** Proprietary/publicly playable reference; the embed page permits iframe embedding but does not publish or license the source, level content, or assets for copying.
- **Useful idea:** Start from a universally readable checkbox, then escalate through self-contained levels with a clear completion signal.
- **Code reused:** No, including no iframe/embed dependency.
- **Attribution requirement:** None triggered. Do not copy exact levels, jokes, copy, visual identity, or assets without permission.
- **How AreUHuman differs:** It is a standalone offline score attack with lives, combos, measured touch skill, persistent rules, PIX, operator tools, and local persistence rather than a sequence of embedded CAPTCHA levels.

## 18. CAPTCHA Hell

- **Project / URL:** [official Steam listing](https://store.steampowered.com/app/4310270/CAPTCHA_Hell/)
- **License:** Commercial/proprietary project; no public source or reusable asset license identified.
- **Useful idea:** Turn an ordinary verification interruption into a larger fiction, use escalating absurdity and interface surprises, and make failure entertaining while retaining a solvable objective.
- **Code reused:** No.
- **Attribution requirement:** None triggered. No code, story, characters, names, art, text, or challenge sequence may be copied without permission.
- **How AreUHuman differs:** It is an immediate school-carnival arcade competition with original biometric-terminal visuals and PIX, not a story-rich fake-desktop adventure about obtaining a concert ticket.

## Adoption guardrails

- Adopt only general principles: modular challenges/rules, measured outcomes, compatibility metadata, concise transitions, procedural/local media, touch diagnostics, and data-driven difficulty.
- Preserve the existing React/TypeScript/Netlify architecture unless a measured need justifies a change; none of these references justifies adding Phaser, crisp-game-lib, or LittleJS.
- Any future direct reuse requires a fresh license check at a pinned revision and a corresponding `THIRD_PARTY_NOTICES.md` entry. Unlicensed, proprietary, organizer-only, or conflicting-license sources remain study-only.

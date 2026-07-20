# Plan: Test harness for the 2048 game

## Goal
Set up `test-harness.js` so tests can be registered and run with a minimal API (`test(name, fn)` plus a few helpers), working both in the browser via the existing control panel and headlessly under Node. Real tests are **not** written yet (that's plan/5-write-tests.md) — only one smoke test to prove the harness.

## Current gaps
- `test-harness.js`'s control panel references `tests`, `runner`, and `runTests` — none of which exist yet, so the panel is non-functional and the module would throw in the browser.
- `tests.js` calls an undefined `test()` and imports nothing.
- `app.js` touches the DOM at module top level (element queries, `keydown` listener, initial render) — importing it under Node would crash.
- Score updates live inside the `keydown` handler, so programmatic moves (from tests) would never update the scoreboard.
- `computeNextState` always spawns a random tile after a successful move — non-deterministic for tests.

## Changes

### app.js — make it environment-agnostic and expose a move pipeline
1. **Guard all DOM access** behind an environment check (`typeof document !== "undefined"`): element lookups, render-handler registration, and the `keydown` listener. The pure logic (`state`, `slideLine`, `computeNextState`, `takeTileId`) stays DOM-free and exported as today; without a DOM, state mutations simply don't render.
2. **Add an exported spawn flag** (a mutable settings object, e.g. `settings.spawnTileAfterMove`, defaulting to `true`) that `computeNextState` consults instead of always spawning. The harness flips it during test runs.
3. **Extract an exported `performMove(direction)`** from the `keydown` handler: compute next state → if moved, apply grid/ids/score/bestScore to the proxy state (inside `document.startViewTransition` when available, synchronously otherwise) → return the outcome (`moved`, `scoreDelta`) plus a promise that resolves once the state update is committed (the view transition's update promise in the browser). The `keydown` handler becomes a thin wrapper. Score and best score then update automatically for programmatic moves, through the same reactive proxy path as real play.
4. `startGame()` stays as-is; its rendering is covered by the DOM guards.

### test-harness.js — registry, runner, helpers (keeping the existing panel untouched)
5. **Registry:** a `tests` array and an exported `test(name, fn)` that appends `{ name, fn }`. No per-test hooks — setup/teardown is centralised in the runner.
6. **Runner object:** `{ running, paused, delay, currentTest }`, matching the fields the control panel already reads/writes.
7. **`runTests(selected)`** (async): sets runner state and refreshes controls; for each test it marks the row as running (browser only), resets to a clean slate (empty grid/ids, score and best score to 0 — *not* resetting `nextTileId`, since ids must stay page-unique) and disables auto-spawn; then awaits the test function inside try/catch, marking the row passed/failed and logging details to the console; honours `runner.paused` between tests. Afterwards it restores the spawn flag, clears `running`, updates the panel with an "N passed, M failed" summary, and logs results (the page already tells users results go to the console). DOM marking no-ops under Node.
8. **Step pacing lives in a `move(direction)` helper, not in tests:** it waits out any pause, calls `performMove`, awaits its completion promise (so assertions never read pre-transition state), then waits `runner.delay` ms. This is what makes the delay slider and Pause button work with zero hooks in the tests themselves.
9. **Board/assertion helpers exported for tests:** `setGrid(values)` to write a 16-cell array into `state`, allocating ids via `takeTileId()` so identity tracking and view transitions keep working; re-exports of `state`, `slideLine`, etc. so `tests.js` imports everything from the harness; and one deep-equality assertion helper that throws with a message — enough to support the pseudo-code style (set board → move → compare grid/score).
10. **Environment split:** the existing DOMContentLoaded panel setup is registered only when a DOM exists. Under Node (no DOM), the harness instead schedules an automatic run of all registered tests once the module graph has finished evaluating (microtask/next tick), prints results to the console, and sets a non-zero exit code on failure. The browser still runs only via the Run button.

### tests.js
11. Fill in the placeholder import with `test` and the helpers from `test-harness.js`. Leave the pseudo-code tests registered as-is — they contain no assertions yet, so they populate the panel list and pass vacuously until plan 5 fleshes them out.
12. Add **one real smoke test** exercising the full harness path end to end: `setGrid` a known board → `move` → assert resulting grid and score.

## Verification
13. Run `node tests.js` (Node 24 handles ESM `.js` with no package.json — confirmed) and confirm the smoke test passes with no DOM present. Then open `test.html` in Chrome, run from the panel, and watch moves render with view transitions at the configured step delay.

## Out of scope
- Writing the real assertions for the placeholder tests (plan/5-write-tests.md).
- Spawn behaviour, win/lose detection, and any new files — the harness works with the existing three JS files.

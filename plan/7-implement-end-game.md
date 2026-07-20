# Plan: End game (game over UI, best-score persistence, play again, swipe controls)

## Goal
Implement the work requested in `plan/6-end-game-plan.md`:

1. Show a "Game over" heading and a "Play again" button in an absolutely-positioned container directly under the board when the board is full and no moves remain.
2. Persist the best score to local storage when the game ends, load it for new games (defaulting to 0), keeping the existing "current score takes precedence over best score" behaviour.
3. Play again hides the container and resets the board.
4. Add swipe gestures anywhere on the page as an alternative to arrow keys.

## Relevant current state (verified against the code)

- **Colors live in `variables.css`, not `colors.css`** (the instruction file references `colors.css` — no such file exists). `variables.css` already has `--color-blue-1` documented as "accent: buttons and form controls" and `--color-brown-2` as "light text on dark boxes" — these suit the button, so **no new color variables are needed**.
- `main.css` uses `@layer reset, view-transitions-base, variables, game;` — all new styles go in the `game` layer. `body` centers the game via `display: grid; place-items: center`, so the game-over container must be `position: absolute` to avoid shifting the board's centering. `.game` currently has no positioning context — it needs `position: relative`.
- **Gotcha:** the UA rule `[hidden] { display: none }` loses to an author rule like `.game-over { display: grid }`. Hiding via the `hidden` attribute therefore requires an explicit `.game-over[hidden] { display: none; }` rule.
- `app.js` state is a Proxy with per-key render handlers (`grid`, `ids`, `score`, `bestScore`). Adding a `gameOver` key + handler fits the established reactive pattern.
- `performMove(direction)` is the shared move pipeline (keyboard today, swipe tomorrow, tests via the harness). Its inner `commit()` closure applies grid/ids/score/bestScore — this is the single seam where the game-over check belongs, and it runs in both browser (inside the board-scoped view transition) and headless Node.
- **Tests run under Node, which has no `localStorage`** — all storage access must be guarded (`typeof localStorage !== "undefined"`), like the existing `hasDom` guards.
- Tests can never accidentally trigger game over: with `settings.spawnTileAfterMove = false`, a successful move on a full board always frees a cell (merges free space; a full board cannot slide without merging), and the one full-board test ("a move that cannot change the grid is rejected") has `moved === false`, so the check (which only runs after a successful move) never fires. Safe by construction; the harness will still reset `gameOver` per test for hygiene.
- `test.html` duplicates the `index.html` game markup. The new container markup must be added there too (or the element lookup must tolerate its absence) since `app.js` renders into that DOM.

## Changes

### index.html (and test.html) — game-over markup
1. Inside `<main class="game">`, after `.board`, add:
   ```html
   <div class="game-over" hidden>
     <h2 class="game-over-heading">Game over</h2>
     <button class="play-again" type="button">Play again</button>
   </div>
   ```
2. Add the identical block to `test.html` so the reactive handler finds the element there as well.

### main.css (in `@layer game`)
3. `.game { position: relative; }` — establishes the containing block without changing layout.
4. `.game-over` — `position: absolute; top: calc(100% + var(--spacing-3)); left: 0; right: 0;` (directly under the board, out of flow so centering is unaffected), `display: grid; justify-items: center; gap: var(--spacing-2);`.
5. `.game-over[hidden] { display: none; }` — required, see gotcha above.
6. `.game-over-heading` — font-size ~1.5rem (typography resets already strip margins).
7. `.play-again` — `background-color: var(--color-blue-1); color: var(--color-brown-2); padding: var(--spacing-1) var(--spacing-3); border: none; border-radius: var(--radius-1); cursor: pointer;` plus a hover/focus state slightly darkened via `color-mix(in oklch, var(--color-blue-1), black 10%)`. reset.css already normalises button typography.

### app.js
8. **Pure game-over predicate:** add `isGameOver(grid)` (exported for tests): returns `false` if any cell is `0`; otherwise checks each cell's right and down neighbour for an equal value (checking right+down covers all adjacencies); returns `true` only when the board is full with no equal neighbours. Pure, no DOM, no state access.
9. **State:** add `gameOver: false` to the proxied state object and a `renderGameOver` handler that toggles the `hidden` attribute on `.game-over` (element looked up alongside the existing refs, guarded by `hasDom`, tolerant of a missing element). Register as `handlers.gameOver`.
10. **Detection:** at the end of `commit()` inside `performMove` (after grid/ids/score/bestScore are applied, so the post-spawn board is what gets evaluated): `if (isGameOver(grid)) { state.gameOver = true; ...persist best score (step 12)... }`. Rejected moves (`moved === false`) never reach this — correct, since a full board with no moves was already reported by the previous successful move.
11. **Input gating:** the `keydown` handler returns early when `state.gameOver` is true (in addition to the existing `settings.keyboardControls` check). The swipe handler (step 15) gates the same way. `performMove`'s contract is unchanged, so tests are unaffected.
12. **Persistence helpers (all storage-guarded, no-ops under Node):**
    - `loadBestScore()`: reads a `"best-score"` key, parses with `Number.parseInt`, returns `0` for missing/invalid values.
    - `saveBestScore(score)`: writes the score as a string.
    - On game over (step 10): `if (state.bestScore > loadBestScore()) saveBestScore(state.bestScore)`. This satisfies "persist only if the game score beat the best score", because `state.bestScore` is only ever raised when `state.score` exceeds it — that existing precedence logic in `commit()` (`if (state.score > state.bestScore) state.bestScore = state.score`) stays exactly as-is.
13. **startGame() update** (used for initial load *and* play again): reset `state.score = 0`, set `state.gameOver = false` (its handler hides the container), set `state.bestScore = loadBestScore()` (new games load from storage, default 0), then build the fresh grid/ids with two spawned tiles as today. Do **not** reset `nextTileId` — ids must stay page-unique across restarts for `data-id`/view-transition names.
14. **Play again:** a click listener on `.play-again` calls `startGame()`. Board cleared, score zeroed, container hidden, best score retained — all through the one function.
15. **Swipe controls (all registered behind `hasDom`), listeners on `document` so swipes work anywhere on the page:**
    - `touchstart`: ignore multi-touch (`event.touches.length > 1`); record the start point from `changedTouches[0].clientX/clientY`.
    - `touchmove` registered with `{ passive: false }`: once a drag is in progress past a small distance, `event.preventDefault()` to suppress scrolling/pull-to-refresh mid-swipe (a JS approach, so no `touch-action: none` CSS is needed and normal page behaviour is untouched until an actual swipe starts).
    - `touchend`: compute `dx`/`dy` from the start point; ignore if `max(|dx|, |dy|)` is below a ~30px threshold (so taps — including on the Play again button — never move tiles); otherwise the dominant axis decides the direction (`dx > 0` → right, `dx < 0` → left, `dy > 0` → down, `dy < 0` → up) and calls `performMove(direction)`, reusing the exact same pipeline as the keyboard.
    - Gate on `state.gameOver` and a new `settings.touchControls` flag (default `true`), mirroring `settings.keyboardControls`.

### test-harness.js
16. In the per-test clean slate in `runTests`, also reset `state.gameOver = false`.
17. Disable `settings.touchControls` for the run and restore it afterwards, alongside the existing `keyboardControls` toggling.
18. Re-export `isGameOver` (and any persistence helpers tests need) so `tests.js` continues to import everything from the harness.

### tests.js — new tests (deterministic, headless-friendly)
19. `isGameOver` returns `false` when the board has empty cells.
20. `isGameOver` returns `false` on a full board with a horizontal pair of equal neighbours.
21. `isGameOver` returns `false` on a full board with a vertical pair of equal neighbours.
22. `isGameOver` returns `true` on a full checkered board (e.g. rows `[2,4,8,16] / [16,8,4,2]` alternating).
23. A rejected move on that checkered board leaves `state.gameOver === false` (detection only runs on successful moves).
24. Best-score parsing: missing/invalid stored values default to `0`; a valid numeric string round-trips (test the pure parse/load helper directly — Node has no `localStorage`, so keep this to helper-level logic, not storage itself).

## Verification
25. Run `node tests.js; echo "exit code: $?"` — all existing and new tests pass, exit code 0 (confirms the Node guards: no `localStorage`/`document` crashes).
26. Manual browser check of `index.html`: play to game over → heading and Play again appear directly under the board without shifting it; click Play again → container hides, board resets with two tiles, score 0, best retained; beat the best score, end the game, reload → best score survives; swipe on a touch device (or Chrome DevTools device emulation) moves tiles from anywhere on the page and taps do not.
27. Open `test.html`, run the suite from the panel — passes with the game-over markup present.

## Out of scope
- A win condition for reaching the 2048 tile.
- Entrance animation or backdrop/overlay styling for the game-over container.
- Changing `performMove`'s return contract or the existing score/best-score precedence logic.

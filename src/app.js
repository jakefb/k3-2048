const SIZE = 4;
const CELL_COUNT = SIZE * SIZE;
const TWO_PROBABILITY = 0.9;

// Flags the test harness flips during test runs.
export const settings = {
  // Spawn a random tile after every successful move. The harness disables
  // this so moves in tests are deterministic.
  spawnTileAfterMove: true,
  // Arrow keys move the tiles. The harness disables this while tests run so
  // key presses cannot disturb the board mid-test.
  keyboardControls: true,
  // Swipe gestures move the tiles. The harness disables this while tests run,
  // mirroring keyboardControls.
  touchControls: true,
  // Persist the board and score to local storage after every move. The
  // harness disables this so test runs cannot clobber a real saved game —
  // the test page shares the origin's storage with the game page.
  persistGameState: true,
};

const KEY_DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// --- DOM references (empty when running headless under Node) ---

const hasDom = typeof document !== "undefined";

const cells = hasDom ? document.querySelectorAll("#grid .cell") : [];
const currentScoreEl = hasDom ? document.getElementById("current-score") : null;
const bestScoreEl = hasDom ? document.getElementById("best-score") : null;
// The game board doubles as the view transition scope: tile animations run
// inside its subtree, so the ::view-transition overlay only covers the board
// and the rest of the page stays on top and interactive.
const boardEl = hasDom ? document.querySelector(".board") : null;
const gameOverEl = hasDom ? document.querySelector(".game-over") : null;
const playAgainEl = hasDom ? document.querySelector(".play-again") : null;

// --- Render handlers (reactive UI updates) ---

function renderGrid(grid) {
  cells.forEach((cell, index) => {
    const value = grid[index];
    cell.textContent = value === 0 ? "" : value;
    if (value === 0) {
      cell.removeAttribute("data-value");
    } else {
      cell.dataset.value = value;
    }
  });
}

function renderIds(ids) {
  cells.forEach((cell, index) => {
    const id = ids[index];
    if (id === 0) {
      cell.removeAttribute("data-id");
      cell.style.viewTransitionName = "";
    } else {
      cell.dataset.id = `view-${id}`;
      // Safari fallback: it does not support attr() outside content, so the
      // CSS rule cannot derive the name from data-id there. Mirror it as an
      // inline style; in supporting browsers the stylesheet's !important
      // attr() declaration still wins over this.
      cell.style.viewTransitionName = `view-${id}`;
    }
  });
}

function renderScores() {
  if (!hasDom) return;
  currentScoreEl.textContent = state.score;
  bestScoreEl.textContent = state.bestScore;
}

function renderGameOver(gameOver) {
  if (!gameOverEl) return;
  gameOverEl.hidden = !gameOver;
}

const handlers = {
  grid: [renderGrid],
  ids: [renderIds],
  score: [renderScores],
  bestScore: [renderScores],
  gameOver: [renderGameOver],
};

// --- Game state, wrapped in a Proxy so mutations trigger UI updates ---

export const state = new Proxy(
  {
    grid: Array(CELL_COUNT).fill(0),
    ids: Array(CELL_COUNT).fill(0),
    score: 0,
    bestScore: 0,
    gameOver: false,
  },
  {
    set(target, key, value) {
      const previous = target[key];
      const changed = Reflect.set(target, key, value);
      if (changed && previous !== value) {
        for (const handler of handlers[key] ?? []) {
          handler(value);
        }
      }
      return changed;
    },
  },
);

// --- Pure game logic (no mutation of live state) ---

// Index of the cell at `position` (0 = edge being moved toward) within
// row/column `line` for the given direction. Reading lines in this order
// lets slideTiles be reused unchanged for all four directions.
function lineIndex(direction, line, position) {
  switch (direction) {
    case "left":
      return line * SIZE + position;
    case "right":
      return line * SIZE + (SIZE - 1 - position);
    case "up":
      return position * SIZE + line;
    case "down":
      return (SIZE - 1 - position) * SIZE + line;
  }
}

// Slides and merges a single line of tiles (null = empty cell) toward its
// front. A tile formed by a merge cannot merge again in the same move, so
// with three equal tiles the two farthest along merge, and with four the
// front pair and back pair merge. A merged tile takes the id of the outer
// tile — the one that traveled into the inner tile — replacing its id.
function slideTiles(tiles) {
  const compacted = tiles.filter((tile) => tile !== null);
  const result = [];
  let scoreDelta = 0;

  for (let i = 0; i < compacted.length; i++) {
    if (compacted[i + 1] !== undefined && compacted[i].value === compacted[i + 1].value) {
      const merged = compacted[i].value * 2;
      result.push({ value: merged, id: compacted[i + 1].id });
      scoreDelta += merged;
      i++; // skip the consumed tile so the merged tile cannot merge again
    } else {
      result.push(compacted[i]);
    }
  }

  while (result.length < SIZE) {
    result.push(null);
  }

  return { line: result, scoreDelta };
}

// Every tile gets the next id, starting at 1.
let nextTileId = 1;

// Allocate the id for a new tile. Exported so tests and demos that place
// tiles on the grid directly share one id sequence with spawned tiles — ids
// feed data-id and view-transition-name, so they must stay page-unique.
export function takeTileId() {
  return nextTileId++;
}

function spawnTile(grid, ids) {
  const emptyIndices = grid.flatMap((value, index) => (value === 0 ? [index] : []));
  if (emptyIndices.length === 0) return;
  const index = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  grid[index] = Math.random() < TWO_PROBABILITY ? 2 : 4;
  ids[index] = takeTileId();
}

export function computeNextState(currentGrid, direction, currentIds = Array(CELL_COUNT).fill(0)) {
  const grid = [...currentGrid];
  const ids = [...currentIds];
  let scoreDelta = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line++) {
    const tiles = [];
    for (let position = 0; position < SIZE; position++) {
      const index = lineIndex(direction, line, position);
      const value = currentGrid[index];
      tiles.push(value === 0 ? null : { value, id: currentIds[index] });
    }
    const { line: slid, scoreDelta: lineScore } = slideTiles(tiles);
    scoreDelta += lineScore;
    for (let position = 0; position < SIZE; position++) {
      const index = lineIndex(direction, line, position);
      const tile = slid[position];
      const value = tile === null ? 0 : tile.value;
      if (grid[index] !== value) moved = true;
      grid[index] = value;
      ids[index] = tile === null ? 0 : tile.id;
    }
  }

  if (moved && settings.spawnTileAfterMove) {
    spawnTile(grid, ids);
  }

  return { grid, ids, scoreDelta, moved };
}

// Pure game-over predicate: the game is over when the board is full and no
// two adjacent cells hold the same value, so no merge remains in any
// direction. Checking each cell's right and down neighbour covers every
// adjacency exactly once.
export function isGameOver(grid) {
  for (let index = 0; index < CELL_COUNT; index++) {
    if (grid[index] === 0) return false;
  }
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const index = row * SIZE + col;
      if (col < SIZE - 1 && grid[index] === grid[index + 1]) return false;
      if (row < SIZE - 1 && grid[index] === grid[index + SIZE]) return false;
    }
  }
  return true;
}

// --- Best-score persistence (local storage; all access guarded for Node) ---

const BEST_SCORE_KEY = "best-score";
const hasStorage = typeof localStorage !== "undefined";

// Parses a stored best-score value; missing or invalid values yield 0.
export function parseBestScore(stored) {
  const parsed = Number.parseInt(stored, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function loadBestScore() {
  if (!hasStorage) return 0;
  return parseBestScore(localStorage.getItem(BEST_SCORE_KEY));
}

function saveBestScore(score) {
  if (!hasStorage) return;
  localStorage.setItem(BEST_SCORE_KEY, String(score));
}

// --- Game-state persistence: resume an in-progress game after a reload ---
//
// Only the grid and score are stored; tile ids are regenerated on load (see
// startGame). A game over clears the entry, so a stored state always
// represents a game with moves remaining.

const GAME_STATE_KEY = "game-state";

// Parses a stored game state; missing or malformed values yield null, so a
// corrupt entry just starts a fresh game.
export function parseGameState(stored) {
  if (stored === null) return null;
  try {
    const parsed = JSON.parse(stored);
    if (
      !Array.isArray(parsed?.grid) ||
      parsed.grid.length !== CELL_COUNT ||
      !parsed.grid.every((value) => Number.isInteger(value) && value >= 0)
    ) {
      return null;
    }
    const score = Number.isInteger(parsed.score) && parsed.score >= 0 ? parsed.score : 0;
    return { grid: parsed.grid, score };
  } catch {
    return null;
  }
}

export function loadGameState() {
  if (!hasStorage) return null;
  return parseGameState(localStorage.getItem(GAME_STATE_KEY));
}

// state.grid is a plain array (the Proxy wraps the state object, not its
// values), so it stringifies directly.
function saveGameState() {
  if (!hasStorage) return;
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ grid: state.grid, score: state.score }));
}

function clearGameState() {
  if (!hasStorage) return;
  localStorage.removeItem(GAME_STATE_KEY);
}

// --- Move pipeline: shared by keyboard controls and programmatic moves ---

// Computes the next state for a move and, if it changed anything, commits it
// to the live state — inside a view transition scoped to the game board when
// the DOM supports it, synchronously otherwise. Score and best score update
// through the same reactive proxy path as real play. Returns the outcome plus
// `done`, a promise that resolves once the state update is committed, so
// callers (tests) never read pre-transition state.
export function performMove(direction) {
  const { grid, ids, scoreDelta, moved } = computeNextState(state.grid, direction, state.ids);
  if (!moved) {
    return { moved, scoreDelta, done: Promise.resolve() };
  }

  const commit = () => {
    state.ids = ids;
    state.grid = grid;
    if (scoreDelta > 0) {
      state.score += scoreDelta;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
      }
    }
    // Evaluate the post-spawn board. Rejected moves never reach this — a
    // full board with no moves left was already reported by the previous
    // successful move.
    if (isGameOver(grid)) {
      state.gameOver = true;
      // A finished game has nothing to resume — drop the saved state.
      if (settings.persistGameState) {
        clearGameState();
      }
      // Persist only if the game score beat the stored best. state.bestScore
      // is only ever raised when state.score exceeds it (above), so the
      // current-score-takes-precedence behaviour carries over to storage.
      if (state.bestScore > loadBestScore()) {
        saveBestScore(state.bestScore);
      }
    } else if (settings.persistGameState) {
      // Persist the move so the game can resume after a reload.
      saveGameState();
    }
  };

  let done;
  if (boardEl && typeof boardEl.startViewTransition === "function") {
    // Scoped transition on the board: only its subtree is snapshotted.
    done = boardEl.startViewTransition(commit).updateCallbackDone;
  } else if (hasDom && typeof document.startViewTransition === "function") {
    // Fallback for browsers without scoped view transitions (Safari): run
    // the transition on the document root instead.
    done = document.startViewTransition(commit).updateCallbackDone;
  } else {
    // No DOM (Node.js tests) or no view-transition support at all.
    commit();
    done = Promise.resolve();
  }

  return { moved, scoreDelta, done };
}

// --- Keyboard controls: the game loop entry point ---

if (hasDom) {
  document.addEventListener("keydown", (event) => {
    if (!settings.keyboardControls || state.gameOver) return;
    const direction = KEY_DIRECTIONS[event.key];
    if (!direction) return;
    event.preventDefault();
    performMove(direction);
  });
}

// --- Swipe controls: touch drags anywhere on the page move tiles ---

const SWIPE_THRESHOLD = 30; // px of travel before a drag counts as a swipe
const SCROLL_SUPPRESS_DISTANCE = 10; // px of travel before a drag suppresses scrolling

if (hasDom) {
  // Start point of the current single-touch drag; null while no swipe is in
  // progress (no touch yet, multi-touch, or controls gated off).
  let swipeStart = null;

  document.addEventListener("touchstart", (event) => {
    if (!settings.touchControls || state.gameOver) return;
    if (event.touches.length > 1) {
      swipeStart = null; // multi-touch is not a swipe
      return;
    }
    const touch = event.changedTouches[0];
    swipeStart = { x: touch.clientX, y: touch.clientY };
  });

  // Once a drag is genuinely under way, suppress scrolling and
  // pull-to-refresh so the swipe is not hijacked mid-gesture. Not passive,
  // so preventDefault works; normal page behaviour is untouched until then.
  document.addEventListener(
    "touchmove",
    (event) => {
      if (!swipeStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - swipeStart.x;
      const dy = touch.clientY - swipeStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > SCROLL_SUPPRESS_DISTANCE) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  document.addEventListener("touchend", (event) => {
    if (!swipeStart) return;
    const start = swipeStart;
    swipeStart = null;
    if (!settings.touchControls || state.gameOver) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Below the threshold it was a tap (e.g. on Play again), not a swipe.
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    // The dominant axis decides the direction.
    const direction =
      Math.abs(dx) >= Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    performMove(direction);
  });
}

// --- Play again: the button in the game-over container starts a new game ---

if (hasDom) {
  playAgainEl?.addEventListener("click", startGame);
}

// --- Game start: fresh board, zeroed score, best score from storage ---

// Used for the initial load and for Play again. Ids are intentionally not
// reset: they feed data-id and view-transition names, so they must stay
// page-unique across restarts.
function startGame() {
  state.gameOver = false; // its handler hides the game-over container
  state.bestScore = loadBestScore(); // new games load the stored best, default 0
  const saved = loadGameState();
  if (saved) {
    // Resume the saved game. Ids are not persisted, so regenerate them from
    // 1 in cell order via takeTileId: it shares one id sequence with spawned
    // tiles, so the next spawned tile's id continues past the highest id
    // assigned here.
    state.score = saved.score;
    state.ids = saved.grid.map((value) => (value === 0 ? 0 : takeTileId()));
    state.grid = saved.grid;
  } else {
    state.score = 0;
    const grid = Array(CELL_COUNT).fill(0);
    const ids = Array(CELL_COUNT).fill(0);
    spawnTile(grid, ids);
    spawnTile(grid, ids);
    state.ids = ids;
    state.grid = grid;
  }
  renderScores();
}

startGame();

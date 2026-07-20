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
    } else {
      cell.dataset.id = `view-${id}`;
    }
  });
}

function renderScores() {
  if (!hasDom) return;
  currentScoreEl.textContent = state.score;
  bestScoreEl.textContent = state.bestScore;
}

const handlers = {
  grid: [renderGrid],
  ids: [renderIds],
  score: [renderScores],
  bestScore: [renderScores],
};

// --- Game state, wrapped in a Proxy so mutations trigger UI updates ---

export const state = new Proxy(
  {
    grid: Array(CELL_COUNT).fill(0),
    ids: Array(CELL_COUNT).fill(0),
    score: 0,
    bestScore: 0,
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
  };

  let done;
  if (boardEl && typeof boardEl.startViewTransition === "function") {
    done = boardEl.startViewTransition(commit).updateCallbackDone;
  } else {
    commit();
    done = Promise.resolve();
  }

  return { moved, scoreDelta, done };
}

// --- Keyboard controls: the game loop entry point ---

if (hasDom) {
  document.addEventListener("keydown", (event) => {
    if (!settings.keyboardControls) return;
    const direction = KEY_DIRECTIONS[event.key];
    if (!direction) return;
    event.preventDefault();
    performMove(direction);
  });
}

// --- Game start: spawn two tiles and render ---

function startGame() {
  const grid = Array(CELL_COUNT).fill(0);
  const ids = Array(CELL_COUNT).fill(0);
  spawnTile(grid, ids);
  spawnTile(grid, ids);
  state.ids = ids;
  state.grid = grid;
  renderScores();
}

startGame();

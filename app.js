const SIZE = 4;
const CELL_COUNT = SIZE * SIZE;
const TWO_PROBABILITY = 0.9;

const KEY_DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// --- DOM references ---

const cells = document.querySelectorAll("#grid .cell");
const currentScoreEl = document.getElementById("current-score");
const bestScoreEl = document.getElementById("best-score");

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
// lets slideLine be reused unchanged for all four directions.
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

// Value-only view of slideTiles, for tests and demos that work with plain
// number lines. Pass `ids` to track tile identities through the slide — the
// returned `ids` line up with the returned values, so demos can keep each
// cell's data-id in sync as its tile moves and merges.
export function slideLine(line, ids = line.map(() => 0)) {
  const { line: slid, scoreDelta } = slideTiles(
    line.map((value, index) => (value === 0 ? null : { value, id: ids[index] })),
  );
  return {
    line: slid.map((tile) => (tile === null ? 0 : tile.value)),
    ids: slid.map((tile) => (tile === null ? 0 : tile.id)),
    scoreDelta,
  };
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

  if (moved) {
    spawnTile(grid, ids);
  }

  return { grid, ids, scoreDelta, moved };
}

// --- Keyboard controls: the game loop entry point ---

document.addEventListener("keydown", (event) => {
  const direction = KEY_DIRECTIONS[event.key];
  if (!direction) return;
  event.preventDefault();

  const { grid, ids, scoreDelta, moved } = computeNextState(state.grid, direction, state.ids);
  if (!moved) return;

  document.startViewTransition(() => {
    state.ids = ids;
    state.grid = grid;
    if (scoreDelta > 0) {
      state.score += scoreDelta;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
      }
    }
  });
});

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

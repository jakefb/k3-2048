import { computeNextState, slideLine, state, takeTileId } from "./app.js";
import {
  assertArrayEqual,
  assertEqual,
  assertGridWithSpawn,
  runner,
  test,
  wait,
} from "./test-harness.js";

// --- The tests themselves, plus the helpers they use. The harness (runner,
// assertions, and the page's control panel) lives in test-harness.js. ---

// --- Helpers ---

const EMPTY_ROW = [0, 0, 0, 0];

function gridFromRows(...rows) {
  return rows.flat();
}

function columnGrid(...values) {
  return gridFromRows(...values.map((value) => [value, 0, 0, 0]));
}

function move(direction) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: `Arrow${direction}` }));
}

// --- Step demos: render each step to the UI, then wait one step interval ---

// Wait one step interval, honoring the current speed and pause state.
async function step() {
  await wait(runner.delay);
}

// Render a grid in the UI within a view transition — like the game's keydown
// handler does for every move — then wait one step so the transition can be
// seen. Every tile needs an id — passed in explicitly, or freshly allocated
// as if the tile had just spawned — so non-empty cells get the data-id that
// the game uses to track tiles (as a view-transition-name) as they move and
// merge.
async function show(grid, ids = grid.map((value) => (value === 0 ? 0 : takeTileId()))) {
  document.startViewTransition(() => {
    state.ids = [...ids];
    state.grid = [...grid];
  });
  await step();
}

function rowGrid(row) {
  return gridFromRows(row, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW);
}

// Slide a single line, showing the line before and after in the UI.
async function demoSlide(input) {
  const ids = input.map((value) => (value === 0 ? 0 : takeTileId()));
  const { line, ids: slidIds } = slideLine(input, ids);
  await show(rowGrid(input), rowGrid(ids));
  await show(rowGrid(line), rowGrid(slidIds));
  return line;
}

// Compute a move, showing the grid before and after in the UI.
async function demoMove(grid, direction) {
  const ids = grid.map((value) => (value === 0 ? 0 : takeTileId()));
  const next = computeNextState(grid, direction, ids);
  await show(grid, ids);
  await show(next.grid, next.ids);
  return next;
}

// --- Tiles slide as far as possible in the chosen direction ---

test("tiles slide as far as possible until stopped by another tile or the edge", async () => {
  assertArrayEqual(await demoSlide([2, 0, 0, 0]), [2, 0, 0, 0], "already at the edge");
  assertArrayEqual(await demoSlide([0, 0, 0, 2]), [2, 0, 0, 0], "slides up to the edge");
  assertArrayEqual(await demoSlide([0, 2, 0, 4]), [2, 4, 0, 0], "stopped by another tile");
  assertArrayEqual(await demoSlide([0, 0, 2, 4]), [2, 4, 0, 0], "both tiles compact");
});

test("tiles slide as far as possible in all four directions", async () => {
  const row = gridFromRows([0, 2, 0, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW);
  assertGridWithSpawn(
    (await demoMove(row, "left")).grid,
    gridFromRows([2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
  );
  assertGridWithSpawn(
    (await demoMove(row, "right")).grid,
    gridFromRows([0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
  );

  const column = columnGrid(0, 2, 0, 4);
  assertGridWithSpawn((await demoMove(column, "up")).grid, columnGrid(2, 4, 0, 0));
  assertGridWithSpawn((await demoMove(column, "down")).grid, columnGrid(0, 0, 2, 4));
});

// --- Merging ---

test("two tiles with the same number merge into a tile with their total value", async () => {
  assertArrayEqual(await demoSlide([2, 2, 0, 0]), [4, 0, 0, 0]);
  assertArrayEqual(await demoSlide([0, 0, 8, 8]), [16, 0, 0, 0]);
});

test("tiles with different numbers do not merge", async () => {
  assertArrayEqual(await demoSlide([2, 4, 0, 0]), [2, 4, 0, 0]);
});

test("a tile created by a merge cannot merge again in the same move", async () => {
  assertArrayEqual(await demoSlide([2, 2, 4, 0]), [4, 4, 0, 0], "must not become [8, 0, 0, 0]");
  assertArrayEqual(await demoSlide([4, 4, 8, 0]), [8, 8, 0, 0], "must not become [16, 0, 0, 0]");
});

test("with three consecutive equal tiles only the two farthest along merge", async () => {
  assertArrayEqual(await demoSlide([2, 2, 2, 0]), [4, 2, 0, 0], "moving left");

  // moving right, the rightmost pair is farthest along the direction of motion
  const grid = gridFromRows([0, 2, 2, 2], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW);
  assertGridWithSpawn(
    (await demoMove(grid, "right")).grid,
    gridFromRows([0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
  );
});

test("four equal tiles in a line merge the first two and the last two", async () => {
  assertArrayEqual(await demoSlide([2, 2, 2, 2]), [4, 4, 0, 0], "row");

  assertGridWithSpawn(
    (await demoMove(columnGrid(2, 2, 2, 2), "down")).grid,
    columnGrid(0, 0, 4, 4),
  );
});

// --- Scoring ---

test("the score starts at zero", () => {
  assertEqual(state.score, 0, "initial score");
});

test("the score increases by the value of each new tile created by a merge", async () => {
  // let the starting grid — tiles carrying fresh ids — be seen before the move
  await show(gridFromRows([2, 2, 0, 0], [8, 8, 0, 0], EMPTY_ROW, EMPTY_ROW));
  const before = state.score;
  move("Left"); // the proxy renders the move and the new score in the UI
  await step(); // let the result and score be seen before asserting
  assertEqual(state.score, before + 4 + 16, "score after merging 2+2 and 8+8 in one move");
});

test("the score does not increase when a move combines no tiles", async () => {
  // let the starting grid — tiles carrying fresh ids — be seen before the move
  await show(gridFromRows([0, 2, 0, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  const before = state.score;
  move("Left"); // the proxy renders the move and the unchanged score in the UI
  await step(); // let the result and score be seen before asserting
  assertEqual(state.score, before, "score after a move with no merges");
});

// --- Moves that change nothing ---

test("a move that cannot change the grid is rejected", async () => {
  const grid = gridFromRows([2, 4, 8, 16], [16, 8, 4, 2], [2, 4, 8, 16], [16, 8, 4, 2]);
  const { grid: nextGrid, moved, scoreDelta } = await demoMove(grid, "left");
  assertEqual(moved, false, "moved");
  assertEqual(scoreDelta, 0, "scoreDelta");
  assertArrayEqual(nextGrid, grid, "grid");
});

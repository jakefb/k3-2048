import { test, setGrid, move, assertDeepEqual, state } from "./test-harness.js";

const EMPTY_ROW = [0, 0, 0, 0];

// Builds a 16-cell grid from four rows.
function gridOf(...rows) {
  return rows.flat();
}

// Builds a 16-cell grid with `values` running down the first column.
function gridWithColumn(values) {
  return values.flatMap((value) => [value, 0, 0, 0]);
}

// Reads the first column of a 16-cell grid.
function firstColumn(grid) {
  return [grid[0], grid[4], grid[8], grid[12]];
}

test("tiles slide as far as possible until stopped by another tile or the edge", async () => {
  await setGrid(gridOf([2, 0, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([2, 0, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "already at the edge",
  );

  await setGrid(gridOf([0, 0, 0, 2], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([2, 0, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "slides up to the edge",
  );

  await setGrid(gridOf([0, 2, 0, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "stopped by another tile",
  );

  await setGrid(gridOf([0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "both tiles compact",
  );
});

test("tiles slide as far as possible in all four directions", async () => {
  const row = [0, 2, 0, 4];

  await setGrid(gridOf(row, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "after move left",
  );

  await setGrid(gridOf(row, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("right");
  assertDeepEqual(
    state.grid,
    gridOf([0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "after move right",
  );

  await setGrid(gridWithColumn(row));
  await move("up");
  assertDeepEqual(firstColumn(state.grid), [2, 4, 0, 0], "after move up");

  await setGrid(gridWithColumn(row));
  await move("down");
  assertDeepEqual(firstColumn(state.grid), [0, 0, 2, 4], "after move down");
});

// --- Merging ---

test("two tiles with the same number merge into a tile with their total value", async () => {
  await setGrid(gridOf([2, 2, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([4, 0, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "2 + 2 merges into 4",
  );

  await setGrid(gridOf([0, 0, 8, 8], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([16, 0, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "8 + 8 merges into 16",
  );
});

test("tiles with different numbers do not merge", async () => {
  await setGrid(gridOf([2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "2 and 4 stay apart",
  );
});

test("a tile created by a merge cannot merge again in the same move", async () => {
  await setGrid(gridOf([2, 2, 4, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([4, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "must not become [8, 0, 0, 0]",
  );

  await setGrid(gridOf([4, 4, 8, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([8, 8, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "must not become [16, 0, 0, 0]",
  );
});

test("with three consecutive equal tiles only the two farthest along merge", async () => {
  await setGrid(gridOf([2, 2, 2, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([4, 2, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "moving left",
  );

  // moving right, the rightmost pair is farthest along the direction of motion
  await setGrid(gridOf([0, 2, 2, 2], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("right");
  assertDeepEqual(
    state.grid,
    gridOf([0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "moving right",
  );
});

test("four equal tiles in a line merge the first two and the last two", async () => {
  await setGrid(gridOf([2, 2, 2, 2], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  await move("left");
  assertDeepEqual(
    state.grid,
    gridOf([4, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW),
    "row",
  );

  await setGrid(gridWithColumn([2, 2, 2, 2]));
  await move("down");
  assertDeepEqual(firstColumn(state.grid), [0, 0, 4, 4], "column");
});

// --- Scoring ---

test("the score starts at zero", () => {
  assertDeepEqual(state.score, 0, "initial score");
});

test("the score increases by the value of each new tile created by a merge", async () => {
  await setGrid(gridOf([2, 2, 0, 0], [8, 8, 0, 0], EMPTY_ROW, EMPTY_ROW));
  const before = state.score;

  await move("left"); // the proxy renders the move and the new score in the UI

  assertDeepEqual(state.score, before + 4 + 16, "score after merging 2+2 and 8+8 in one move");
});

test("the score does not increase when a move combines no tiles", async () => {
  await setGrid(gridOf([0, 2, 0, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW));
  const before = state.score;

  await move("left"); // the proxy renders the move and the unchanged score in the UI

  assertDeepEqual(state.score, before, "score after a move with no merges");
});

// --- Moves that change nothing ---

test("a move that cannot change the grid is rejected", async () => {
  const grid = gridOf([2, 4, 8, 16], [16, 8, 4, 2], [2, 4, 8, 16], [16, 8, 4, 2]);
  await setGrid(grid);

  const outcome = await move("left");

  assertDeepEqual(outcome.moved, false, "move rejected");
  assertDeepEqual(state.grid, grid, "grid");
});

import {
  // modules
} from "./test-harness.js";

const EMPTY_ROW = [0, 0, 0, 0];

test("tiles slide as far as possible until stopped by another tile or the edge", async () => {
  // [2, 0, 0, 0] === [2, 0, 0, 0], "already at the edge"
  // [0, 0, 0, 2]) === [2, 0, 0, 0], "slides up to the edge"
  // [0, 2, 0, 4]) === [2, 4, 0, 0], "stopped by another tile"
  // [0, 0, 2, 4]), [2, 4, 0, 0], "both tiles compact"
});

test("tiles slide as far as possible in all four directions", async () => {
  // const grid = [0, 2, 0, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW

  // move left

  // should equal [2, 4, 0, 0], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW

  // move right

  // should equal [0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW

  // const column = a column of [0, 2, 0, 4]

  // move up

  // should equal a column of [2, 4, 0, 0]

  // move down

  // should equal a column of [0, 0, 2, 4]
});

// --- Merging ---

test("two tiles with the same number merge into a tile with their total value", async () => {
  // [2, 2, 0, 0] === [4, 0, 0, 0]
  // [0, 0, 8, 8] === [16, 0, 0, 0]
});

test("tiles with different numbers do not merge", async () => {
  // [2, 4, 0, 0] === [2, 4, 0, 0]
});

test("a tile created by a merge cannot merge again in the same move", async () => {
  // [2, 2, 4, 0] === [4, 4, 0, 0], "must not become [8, 0, 0, 0]"
  // [4, 4, 8, 0] === [8, 8, 0, 0], "must not become [16, 0, 0, 0]"
});

test("with three consecutive equal tiles only the two farthest along merge", async () => {
  // [2, 2, 2, 0] === [4, 2, 0, 0], "moving left"

  // moving right, the rightmost pair is farthest along the direction of motion
  // const grid = [0, 2, 2, 2], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW

  // move right

  // should equal [0, 0, 2, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW
});

test("four equal tiles in a line merge the first two and the last two", async () => {
  // [2, 2, 2, 2] === [4, 4, 0, 0], "row"

  // const column = a column of [2, 2, 2, 2]

  // move down

  // should equal a column of [0, 0, 4, 4]
});

// --- Scoring ---

test("the score starts at zero", () => {
  // state.score === 0, "initial score"
});

test("the score increases by the value of each new tile created by a merge", async () => {
  // show [2, 2, 0, 0], [8, 8, 0, 0], EMPTY_ROW, EMPTY_ROW
  // move left — the proxy renders the move and the new score in the UI
  // state.score === before + 4 + 16, "score after merging 2+2 and 8+8 in one move"
});

test("the score does not increase when a move combines no tiles", async () => {
  // show [0, 2, 0, 4], EMPTY_ROW, EMPTY_ROW, EMPTY_ROW
  // move left — the proxy renders the move and the unchanged score in the UI
  // state.score === before, "score after a move with no merges"
});

// --- Moves that change nothing ---

test("a move that cannot change the grid is rejected", async () => {
  // const grid = [2, 4, 8, 16], [16, 8, 4, 2], [2, 4, 8, 16], [16, 8, 4, 2]

  // move left

  // the resulting grid === the starting grid, "grid"
});

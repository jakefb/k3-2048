import { state, computeNextState, takeTileId, performMove, settings } from "./app.js";

// Re-export the game API so test modules import everything from the harness.
export { state, computeNextState, takeTileId, performMove, settings };

const hasDom = typeof document !== "undefined";

// --- Test registry ---

const tests = [];

// Registers a test. There are no per-test hooks — the runner resets the game
// to a clean slate before every test.
export function test(name, fn) {
  tests.push({ name, fn });
}

// --- Runner state, shared with the control panel ---

const runner = {
  running: false,
  paused: false,
  delay: 600, // ms to linger after each move; the delay slider overrides this
  currentTest: null,
};

// --- Elapsed-time timer ---

// Formats milliseconds as m:ss.d, e.g. 0:04.8.
function formatElapsed(ms) {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

// Wall clock for the panel. Banks the elapsed time whenever the run is
// paused, so the display freezes while paused and resume() continues from
// the banked total instead of counting the paused stretch. Headless there
// is no display and no pausing, so no interval is ever created.
const runTimer = {
  banked: 0, // ms accumulated before the current active stretch
  startedAt: 0, // performance.now() at the last start/resume
  intervalId: null,

  elapsed() {
    const active = this.intervalId === null ? 0 : performance.now() - this.startedAt;
    return this.banked + active;
  },

  // Fresh run: zero the clock and start ticking.
  start() {
    this.banked = 0;
    this.resume();
  },

  resume() {
    if (!hasDom || this.intervalId !== null) return;
    this.startedAt = performance.now();
    this.intervalId = setInterval(() => this.render(), 100);
    this.render();
  },

  // Freeze the display, keeping the total for resume() or stop().
  pause() {
    if (this.intervalId === null) return;
    this.banked += performance.now() - this.startedAt;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.render();
  },

  // Run finished: bank the final stretch; the total stays on display.
  stop() {
    this.pause();
  },

  render() {
    if (!hasDom) return;
    timerEl.textContent = formatElapsed(this.elapsed());
  },
};

// --- Helpers for tests ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resolves once the runner is no longer paused.
function waitWhilePaused() {
  return new Promise((resolve) => {
    const check = () => (runner.paused ? setTimeout(check, 50) : resolve());
    check();
  });
}

// Writes a 16-cell array of values into the live state, allocating a fresh
// tile id per non-zero cell so identity tracking (data-id, view-transition
// names) keeps working for tiles placed by tests. Then lingers for the step
// delay, so the set-up board is visible in the browser before the test's
// first move — the same pacing move() applies between moves. Await it so the
// test's moves stay in step with the delay slider and Pause button.
export async function setGrid(values) {
  state.ids = values.map((value) => (value === 0 ? 0 : takeTileId()));
  state.grid = [...values];
  await waitWhilePaused();
  await sleep(runner.delay);
}

// Performs one move with test pacing: waits out any pause, commits the move
// and awaits the commit (so assertions never read pre-transition state),
// then lingers for the step delay so the move is visible in the browser.
// This is what makes the delay slider and Pause button work with zero hooks
// in the tests themselves.
export async function move(direction) {
  await waitWhilePaused();
  const outcome = performMove(direction);
  await outcome.done;
  await sleep(runner.delay);
  return outcome;
}

// Deep-equality assertion for the plain data tests compare (grids, lines,
// scores). Throws with a diff-style message on mismatch.
export function assertDeepEqual(actual, expected, message = "assertion failed") {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`);
  }
}

// --- Runner ---

// Marks a test's row in the panel; a no-op headless, where no rows exist.
function markTest(name, result) {
  const item = testItems.get(name);
  if (item) {
    item.dataset.result = result;
  }
}

// Wipes the result marks from every row in the panel, so a new run starts
// with no stale passed/failed indicators from the previous run. A no-op
// headless, where the map is empty.
function clearResults() {
  for (const item of testItems.values()) {
    delete item.dataset.result;
  }
}

async function runTests(selected) {
  runner.running = true;
  runner.paused = false;
  // Ignore arrow keys for the whole run so they cannot move tiles mid-test.
  settings.keyboardControls = false;
  clearResults();
  runTimer.start();
  updateControls();

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of selected) {
    runner.currentTest = name;
    markTest(name, "running");
    updateControls();

    // Reset to a clean slate: empty board, zeroed scores — but not
    // nextTileId, since ids must stay page-unique. Disable auto-spawn so
    // moves are deterministic.
    state.ids = Array(state.grid.length).fill(0);
    state.grid = Array(state.grid.length).fill(0);
    state.score = 0;
    state.bestScore = 0;
    settings.spawnTileAfterMove = false;

    try {
      await fn();
      passed++;
      markTest(name, "passed");
      console.log(`\u2705 ${name}`);
    } catch (error) {
      failed++;
      markTest(name, "failed");
      console.error(`\u274C ${name}`);
      console.error(error);
    }

    await waitWhilePaused();
  }

  settings.spawnTileAfterMove = true;
  settings.keyboardControls = true;
  runner.running = false;
  runner.currentTest = null;
  runTimer.stop();

  const summary = `${passed} passed, ${failed} failed`;
  updateControls(summary);
  console.log(summary);

  return { passed, failed };
}

// --- Control panel: select tests, run/pause/resume, adjust the step delay ---

const testItems = new Map(); // test name -> <li>, for marking results

// Element references, assigned in setupControls().
let runButton;
let pauseButton;
let delayInput;
let delayOutput;
let selectAllButton;
let selectNoneButton;
let testList;
let statusEl;
let timerEl;

function updateControls(summary) {
  if (!hasDom) return; // headless: there is no panel to update
  runButton.disabled = runner.running;
  pauseButton.disabled = !runner.running;
  pauseButton.textContent = runner.paused ? "Resume" : "Pause";
  selectAllButton.disabled = runner.running;
  selectNoneButton.disabled = runner.running;
  for (const checkbox of testList.querySelectorAll("input")) {
    checkbox.disabled = runner.running;
  }
  testList.classList.toggle("paused", runner.paused); // swaps the inline spinner for ⏸
  timerEl.classList.toggle("paused", runner.paused); // dims the frozen timer
  if (runner.running) {
    // The running test is marked inline (a spinner, or ⏸ while paused), so
    // the status line stays empty for the whole run.
    statusEl.textContent = "";
  } else {
    statusEl.textContent = summary ?? "Select one or more tests, then press Run.";
  }
}

function setAllChecked(checked) {
  for (const checkbox of testList.querySelectorAll("input")) {
    checkbox.checked = checked;
  }
}

// Build the control panel once the DOM is ready and every test module has
// registered its tests. This module is evaluated before the test modules
// that import it, and module scripts all run before DOMContentLoaded, so
// deferring the setup guarantees the test list is complete.
function setupControls() {
  runButton = document.getElementById("run-tests");
  pauseButton = document.getElementById("pause-tests");
  delayInput = document.getElementById("step-delay");
  delayOutput = document.getElementById("step-delay-value");
  selectAllButton = document.getElementById("select-all");
  selectNoneButton = document.getElementById("select-none");
  testList = document.getElementById("test-list");
  statusEl = document.getElementById("test-status");
  timerEl = document.getElementById("test-timer");

  // One row per registered test: a checkbox to enable/disable the test, its
  // description, and a status cell for the spinner or result. All tests are
  // selected by default; deselected rows are muted.
  for (const [index, { name }] of tests.entries()) {
    const item = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.id = `test-${index}`;
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = name;
    const status = document.createElement("span");
    status.className = "test-result";
    checkbox.addEventListener("change", () => {
      item.classList.toggle("muted", !checkbox.checked);
    });
    item.append(checkbox, label, status);
    testList.append(item);
    testItems.set(name, item);
  }

  runButton.addEventListener("click", () => {
    const checkboxes = [...testList.querySelectorAll("input")];
    const selected = tests.filter((_, index) => checkboxes[index].checked);
    if (selected.length === 0) {
      statusEl.textContent = "Select at least one test to run.";
      return;
    }
    runTests(selected);
  });

  pauseButton.addEventListener("click", () => {
    runner.paused = !runner.paused;
    if (runner.paused) {
      runTimer.pause();
    } else {
      runTimer.resume();
    }
    updateControls();
  });

  selectAllButton.addEventListener("click", () => setAllChecked(true));
  selectNoneButton.addEventListener("click", () => setAllChecked(false));

  delayInput.value = runner.delay;
  runner.delay = Number(delayInput.value); // clamp to the slider's range
  delayOutput.textContent = `${runner.delay}ms`;
  // While dragging, only preview the value in the output; the running tests
  // keep using the old delay. The new delay applies on "change", which fires
  // when the slider is released (or a keyboard adjustment is committed).
  delayInput.addEventListener("input", () => {
    delayOutput.textContent = `${delayInput.value}ms`;
  });
  delayInput.addEventListener("change", () => {
    runner.delay = Number(delayInput.value);
    delayOutput.textContent = `${runner.delay}ms`;
  });

  updateControls();
}

// Environment split. In the browser tests run from the panel's Run button;
// module scripts run after parsing but before DOMContentLoaded fires, so the
// panel setup always happens after the test modules that import this one.
// Headless (Node) there is no panel — run every registered test once the
// whole module graph has finished evaluating, and exit non-zero on failure.
if (hasDom) {
  document.addEventListener("DOMContentLoaded", setupControls);
} else {
  queueMicrotask(async () => {
    runner.delay = 0; // nothing to watch headless, so no step delay
    const { failed } = await runTests(tests);
    if (failed > 0) {
      process.exitCode = 1;
    }
  });
}

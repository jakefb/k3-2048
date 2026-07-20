import { state } from "./app.js";

// --- Minimal test harness: defines tests, runs them, logs to the console ---
// The control panel on the test page selects which tests to run, pauses and
// resumes a run in progress, and adjusts the step delay — the wait interval
// after each step within a test and after each test completes — so you can
// watch the grid and score update in the UI as you follow along. Append
// ?slow (or ?slow=<ms>) to the URL to preset the step delay.
//
// Test files import { test } (and the assertions) from this module and
// register their tests with test(name, fn); the harness wires up the control
// panel once the DOM is ready and every test module has been evaluated.

const slowParam = new URLSearchParams(location.search).get("slow");
const INITIAL_DELAY_MS = Number(slowParam) > 0 ? Number(slowParam) : 600;
const WAIT_SLICE_MS = 50; // how often a wait checks the pause state

const tests = [];
let passCount = 0;
let failCount = 0;

// Mutable state for the current run, driven by the page's control panel.
export const runner = {
  delay: INITIAL_DELAY_MS, // wait interval after each step
  paused: false,
  running: false,
  currentTest: null,
};

export function test(name, fn) {
  tests.push({ name, fn });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wait `ms` milliseconds in short slices, so pausing takes effect quickly
// and resuming continues the wait where it left off.
export async function wait(ms) {
  let remaining = ms;
  while (remaining > 0) {
    while (runner.paused) {
      await sleep(WAIT_SLICE_MS);
    }
    const slice = Math.min(remaining, WAIT_SLICE_MS);
    await sleep(slice);
    remaining -= slice;
  }
}

async function runTests(selected) {
  runner.running = true;
  runner.paused = false;
  passCount = 0;
  failCount = 0;
  for (const item of testItems.values()) {
    item.removeAttribute("data-result");
  }
  updateControls();

  for (const { name, fn } of selected) {
    runner.currentTest = name;
    testItems.get(name).dataset.result = "running"; // inline spinner marks the running test
    updateControls();
    console.log(`▶️ Running: ${name}`);
    resetState(); // make every run repeatable, regardless of previous runs
    try {
      await fn();
      passCount++;
      testItems.get(name).dataset.result = "passed";
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      failCount++;
      testItems.get(name).dataset.result = "failed";
      console.error(`❌ FAIL: ${name}\n   ${error.message}`);
    }
    await wait(runner.delay);
  }

  runner.running = false;
  runner.currentTest = null;

  const summary = `${passCount + failCount} tests: ${passCount} passed, ${failCount} failed`;
  if (failCount > 0) {
    console.error(summary);
  } else {
    console.log(summary);
  }
  updateControls(summary);
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Reset the live game state so tests are isolated from each other and from
// previous runs (e.g. "the score starts at zero" must hold on every run).
function resetState() {
  state.grid = Array(state.grid.length).fill(0);
  state.ids = Array(state.ids.length).fill(0);
  state.score = 0;
  state.bestScore = 0;
}

function format(value) {
  return Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
}

export function assertEqual(actual, expected, label = "value") {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${format(expected)}, got ${format(actual)}`,
  );
}

export function assertArrayEqual(actual, expected, label = "line") {
  assert(
    Array.isArray(actual) &&
      actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]),
    `${label}: expected ${format(expected)}, got ${format(actual)}`,
  );
}

// computeNextState spawns a random tile (2 or 4) on an empty cell after every
// successful move, so full-grid comparisons allow exactly one such difference.
export function assertGridWithSpawn(actual, expected) {
  const spawnedAt = [];
  for (let index = 0; index < expected.length; index++) {
    if (actual[index] !== expected[index]) {
      spawnedAt.push(index);
    }
  }
  assert(
    spawnedAt.length === 1 &&
      expected[spawnedAt[0]] === 0 &&
      (actual[spawnedAt[0]] === 2 || actual[spawnedAt[0]] === 4),
    `grid: expected ${format(expected)} plus one spawned tile, got ${format(actual)}`,
  );
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

function updateControls(summary) {
  runButton.disabled = runner.running;
  pauseButton.disabled = !runner.running;
  pauseButton.textContent = runner.paused ? "Resume" : "Pause";
  selectAllButton.disabled = runner.running;
  selectNoneButton.disabled = runner.running;
  for (const checkbox of testList.querySelectorAll("input")) {
    checkbox.disabled = runner.running;
  }
  testList.classList.toggle("paused", runner.paused); // freezes the inline spinner
  if (runner.running) {
    // The running test is shown inline with a spinner, so the status line
    // only needs to say something while the run is paused.
    statusEl.textContent = runner.paused ? `⏸ Paused: ${runner.currentTest}` : "";
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
    updateControls();
  });

  selectAllButton.addEventListener("click", () => setAllChecked(true));
  selectNoneButton.addEventListener("click", () => setAllChecked(false));

  delayInput.value = runner.delay;
  runner.delay = Number(delayInput.value); // clamp to the slider's range
  delayOutput.textContent = `${runner.delay}ms`;
  delayInput.addEventListener("input", () => {
    runner.delay = Number(delayInput.value);
    delayOutput.textContent = `${runner.delay}ms`;
  });

  updateControls();
}

// Module scripts run after parsing but before DOMContentLoaded fires, so
// this always runs after the test modules that import this one.
document.addEventListener("DOMContentLoaded", setupControls);

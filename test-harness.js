import { state } from "./app.js";

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

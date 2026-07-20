# Test harness plan

Create a plan for the below work. In the plan detail how this can be accomplished at a high level, without delving too deep into how the code will look exactly. Outline what changes will need making. It should be possible to hand off your plan to a developer to execute

The requested work to create a plan for:

In the test-harness.js file, create a test harness that allows the game to be tested in tests.js. I have added some comments with psuedo code showing what kind of tests we will need. Do not write all the actual tests themselves yet, but set up the harness so tests can be written later.

Requirements of harness:
- The harness should allow the tests to be defined using minimal functions, similar to the psuedo code. There shouldn't be a need to run certain hooks on every test.
- Each test should behave like the game, with the exception that it should be possible to disable the automatic creation of a new tile after a move is made. Possibly the app.js needs a flag created to disable this. The scoreboard however should update automatically when tiles are merged when the tests run.
- Within the test harness there is already some code that sets up a panel for selecting which tests run and slowing down the tests (i.e. adding a pause between each move). The test harness should work with this, without additional hooks needing to be added to the tests themselves.
- There should be an option to load and run the tests within node.js (i.e. with no DOM). None of the tests or harness should not depend on the DOM being present. However it should be possible for the tests to run in the browser and see the game running. This is purely as a visualisation but should not be essential for the tests to complete.
- After you have set up the harness you may add a single test just to test the harness. You may run this with node.

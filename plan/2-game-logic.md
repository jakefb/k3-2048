# Game logic.

Create a high level plan (i.e. what game state will look like, what the function that calculates next game state will look like, what handlers will be required) based on the below steps before proceeding (DO NOT write any code). Check for feedback before executing the plan.

Overview of html page:
- Score header above the grid: Score (#current-score) and Best (#best-score) boxes with placeholder 0 values, ready to be populated later
- 4x4 grid: a .grid container with 16 .cell elements

- Create the game state as a single JS object.
- Set up a Proxy that wraps the game state
- Set up function that runs to calculate the next game state (ie calculating tile size). This may call multiple smaller functions. Isolate and reuse logic where possible.
- Set up handlers that update the CSS grid when the game state changes. This makes imperative DOM manipulation code reactive to state changes and presented in a declarative way.
- Set up keyboard controls that mutate the game state object

Overview of game loop:

Keyboard -> runs function to calculate next game state -> mutates game state object -> updates UI

Requirements:

- The arrow keys on the keyboard are the controls
- Tiles with a value of 2 appear 90% of the time, and tiles with a value of 4 appear 10% of the time.
- Tiles slide as far as possible in the chosen direction until they are stopped by either another tile or the edge of the grid.
- If two tiles of the same number collide while moving, they will merge into a tile with the total value of the two tiles that collided.
- The resulting tile cannot merge with another tile again in the same move
- If a move causes three consecutive tiles of the same value to slide together, only the two tiles farthest along the direction of motion will combine.
- If all four spaces in a row or column are filled with tiles of the same value, a move parallel to that row/column will combine the first two and last two.
- The user's score starts at zero, and is increased whenever two tiles combine, by the value of the new tile.

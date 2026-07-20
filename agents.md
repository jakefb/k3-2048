Your goal is to create a 2048-like web based game, but you must do it one step at a time as instructed rather than creating the whole game at once. 2048 is a sliding puzzle game. The objective of the game is to slide numbered tiles on a grid to combine them to create a tile with the number 2048.

All project files are within the src/ level directory. ensure you are cd'ed into src/, and assume any paths mentioned (except for paths under plan/) are relative to it as the working directory.

The project is built as a minimal web app:
- HTML5, modern CSS features targeting latest Chrome version
- ES6+ JavaScript module files with zero third party dependencies and no package manager, package.json - i.e. vanilla JS
- Main css file is main.css
- A very minimal CSS reset file is defined at reset.css - this sets the default box-sizing to border box, removes all margins, and applies typography resets for headings, inputs and buttons
- Variables are defined in variables.css

Overview of game architecture:
- CSS grid is used for the 4x4 tile grid
- The arrow keys on the keyboard are used for the controls

Styling rules:
- Do not use inline styles
- Use CSS variables for colors and spacing
- Define colors as descriptive variables such as --color-blue-1, using oklch.
- Use css layers

Before submitting your work, run the unit tests with: node tests.js; echo "exit code: $?"

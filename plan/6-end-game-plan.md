Do not build anything or write any code. Instead write a plan to implement the following:

- When the board becomes full and there's no moves left, show a "game over" heading. Show this as a header positioned as absolute directly under the board so it doesn't affect the centering of the board. Show a "play again" button underneath. Essentially the heading and button should be in an absolute positioned container div. Use nice colours for the button (check the existing variables in colors.css to see if there's anything suitable, if not add new colours)
- When game is over persist the bestScore to the local storage if the game score beat the best score. Make sure new games load this from local storage and if not default to zero. Ensure behaviour of the current score taking precedence over the best score if it is higher than the best score is retained
- Ensure when the "play again" button is clicked the wrapper container is removed hidden, and the board state is cleared
- Add swipe gestures for touch devices that can happen anywhere on the page, as another way of controlling the game instead of the keyboard for devices like phones.

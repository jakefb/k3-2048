Write unit test within tests.js. I have created some pseudo test code you can utalise.

it should meet the following game logic requirements:

- Tiles slide as far as possible in the chosen direction until they are stopped by either another tile or the edge of the grid.
- If two tiles of the same number collide while moving, they will merge into a tile with the total value of the two tiles that collided.
- The resulting tile cannot merge with another tile again in the same move
- If a move causes three consecutive tiles of the same value to slide together, only the two tiles farthest along the direction of motion will combine.
- If all four spaces in a row or column are filled with tiles of the same value, a move parallel to that row/column will combine the first two and last two.
- The user's score starts at zero, and is increased whenever two tiles combine, by the value of the new tile.

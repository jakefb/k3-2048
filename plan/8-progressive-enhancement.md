Implement the following progressive enhancement fallbacks to get the view transitions working in Safari. Safari currently does not support using attr() for any CSS property and it also does not support scoped view transitions. Use a progressive enhancement approach to set the css styles and JS handlers with older techniques so it works in safari, and when the newer features are supported ensure it's progressively enhanced.

You need to do the following:
- In the app code, when a data-id is set, also set the inline style on the element with the equivalent property - i.e. `view-transition-name`. 
- You will need to add an !important to the css line that sets the name using attr() so it takes precedence over the style set with the style attribute.
- For the JS code that calls the scoped startViewTransition on the game board element, you need to check if this method is available on the element, and if not call it on document instead. The current fallback for no DOM should also continue to work for when it is running in a nodejs environment.

What does not need changing:

- Usage of `content: attr(data-id)` is fine since that works in Safari.

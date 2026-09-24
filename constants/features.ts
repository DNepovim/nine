// One switch per part of the app that can currently be shown or not, kept here rather
// than in the screen that happens to own the button — a feature reaches the player
// through more than one door, and a flag that lives behind one of them gets flipped
// while the others stay open.

// Whether playing with friends is offered at all: the ALONE / WITH FRIENDS tabs on the
// intro, and the chapter of How to Play that explains them. Off while the intro is being
// fitted into a short phone — the waiting room, the shared run and the results are
// untouched, so what is hidden is the way in and the page about it, not the feature.
//
// Widened off the literal on purpose: as `false` it narrows, and every guard on it reads
// as dead code to anything type-aware rather than as a switch with one side down.
export const SHOW_MULTIPLAYER = false as boolean

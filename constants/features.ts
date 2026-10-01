import type { Floor } from '@/lib/role'

// One entry per part of the app that is not for everyone yet, kept here rather than in
// the screen that happens to own the button — a feature reaches the player through more
// than one door, and a flag that lives behind one of them gets flipped while the others
// stay open.
//
// Each entry names the lowest role that may see it, and every role above inherits it: a
// flag floored at `tester` is shown to a developer and an admin too. A player with no
// role — which is all but a handful of rows — sees none of them. The ladder itself is
// lib/role.ts; the reading of it is hooks/use-flags.tsx.
//
// There is deliberately no floor meaning "everyone". A feature ready for every player
// loses its flag and its guards rather than dropping to rank zero — a flag nobody is
// kept out by is a guard that goes on reading as load-bearing long after it stopped
// being so.
//
// There is a floor meaning nobody, though — `nobody`, the other end of the same argument.
// A feature taken off the app for a while still needs its doors shut, and shutting them
// by deleting the guards would mean writing them again to put it back.
export const FLAGS = {
  // Playing with friends: the ALONE / WITH FRIENDS tabs on the intro, and the chapter of
  // How to Play that explains them. Off for everyone, testers and admins included, while
  // the intro is being fitted into a short phone — the waiting room, the shared run and
  // the results are untouched, so what is hidden is the way in and the page about it, not
  // the feature. Floored back at `tester` when there is something to report on again.
  multiplayer: 'nobody',
  // Arcade: the pill on the intro, the screen behind it, and the chapter of How to Play
  // that explains it. A proof of concept — one way in, one way back, and a depth instead
  // of a score — so it is floored at `developer` rather than `tester`: what it needs now
  // is the people who can change it, not the people who can report on it.
  //
  // Without the flag the pill is still there, still wearing SOON, still unpressable. That
  // is deliberate: the teaser was already a promise to players, and taking it away to
  // build behind it would be answering a promise with an absence.
  arcade: 'developer',
} as const satisfies Record<string, Floor>

export type Flag = keyof typeof FLAGS

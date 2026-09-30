import type { Role } from '@/lib/role'

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
export const FLAGS = {
  // Playing with friends: the ALONE / WITH FRIENDS tabs on the intro, and the chapter of
  // How to Play that explains them. Off for players while the intro is being fitted into
  // a short phone — the waiting room, the shared run and the results are untouched, so
  // what is hidden is the way in and the page about it, not the feature. On for testers,
  // who are the people it needs to be reachable by.
  multiplayer: 'tester',
} as const satisfies Record<string, Role>

export type Flag = keyof typeof FLAGS

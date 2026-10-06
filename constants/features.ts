// One entry per part of the app that is not for everyone yet, kept here rather than in
// the screen that happens to own the button — a feature reaches the player through more
// than one door, and a flag that lives behind one of them gets flipped while the others
// stay open.
//
// This list is the whole of what the code knows. *Who* reaches each one — which roles
// exist, what each role's stack holds, what one person has had added or taken away, and
// whether the feature is switched on at all — is rows in the database, edited from the
// admin screen. See the …_feature_flags.sql migration, and `effective_features`, which
// is the one place the rules are written.
//
// A key here with no row in `features` resolves to off; a row there with no key here is
// shown on the admin screen as not in this build. Both are worth seeing and neither is
// an error — a device can be older than the server, and a migration can outlive a guard.
export const FLAGS = [
  // Playing with friends: the ALONE / WITH FRIENDS tabs on the intro, and the chapter of
  // How to Play that explains them.
  'multiplayer',
  // Arcade: the pill on the intro, the screen behind it, and the chapter of How to Play
  // that explains it. Without the feature the pill is still there, still wearing SOON,
  // still unpressable — the teaser was already a promise to players, and taking it away
  // to build behind it would be answering a promise with an absence.
  'arcade',
  // The DEV link on the intro, and the screen behind it: every challenge ever written,
  // playable on demand with no board kept for it.
  'dev',
  // The ADMIN link on the intro, and the screen behind it. Protected in the database:
  // it cannot be switched off, and nobody can take it from themselves — this is not a
  // feature being tried out, it is the door that decides who sees the others.
  'admin',
] as const

export type Flag = (typeof FLAGS)[number]

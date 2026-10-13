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
  // The challenge lab: every challenge ever written, playable on demand outside its own
  // window, with no board kept for it. What a tester testing a new challenge holds.
  //
  // Called `dev` until the planner arrived, which named the door rather than the thing
  // behind it — and the door is about to hold more than one. `DEV_FEATURES` below is what
  // the link itself now asks.
  'challengeLab',
  // What a player sees of challenges: the card on the start screen that says one is on,
  // the dialog behind it with the standings, and the chapter of How to Play that explains
  // them. Gates the reads as well as the card — a player who cannot be shown a session
  // has no business asking the server which ones are open.
  'challenges',
  // The weekly recap: the page in the launch popup, on the first open of a new week, that
  // says what last week on the boards came to. Gates the read as well as the card — a
  // player who cannot be shown it has no business asking the server about it.
  'recap',
  // Czech: the LANGUAGE row in options, and so the only door to any language but
  // English. Without the feature the app is in English and stays there — a locale
  // stored by a build that reached this one is kept, not cleared, so granting it again
  // lands the player back in the language they chose. See hooks/use-locale.tsx.
  'czech',
  // The ADMIN link on the intro, and the screen behind it. Protected in the database:
  // it cannot be switched off, and nobody can take it from themselves — this is not a
  // feature being tried out, it is the door that decides who sees the others.
  'admin',
] as const

export type Flag = (typeof FLAGS)[number]

// The features reached through the DEV link on the intro, rather than the one that used
// to be it. The link appears for anybody holding any of them, and the screen behind it
// shows the sections they hold — so a second entry here is the whole of what it takes to
// put a second thing in there without widening who can see the first.
export const DEV_FEATURES = ['challengeLab'] as const satisfies readonly Flag[]

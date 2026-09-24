// Everything that stacks over the game, in one scale. The numbers only ever matter
// against each other, so they live here rather than being spelled out at each view —
// two files picking their own 30 and 40 is how a dialog ends up under the screen it
// was opened from.
//
// Lower is further back. The game itself is not on the scale: it is what the whole
// stack sits over, and it never lifts off the flow.
export const LAYER = {
  // A screen on its way in, for as long as the screen it replaces is still leaving.
  // One step under `screen` on purpose — see components/screen.tsx.
  arrivingScreen: 9,
  // Every full-viewport screen: the intro, the pause screen, options, the guide, the
  // archive, a lesson. One layer for all of them, because only one is ever settled.
  screen: 10,
  // The feedback tab, over whichever screen is up.
  bookmark: 11,
  // Dialogs: they cover a screen without replacing it, scrim and all.
  dialog: 40,
  // The cold-start logo, over everything the app has managed to build behind it.
  splash: 100,
  // The one thing allowed over the splash — the install prompt it holds for.
  splashPrompt: 101,
} as const

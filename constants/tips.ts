// Playing advice, shown two places: rotating in the Trainee slot of the menu, and
// listed under TIPS & TRICKS in the how-to-play guide. One list so the two cannot
// drift — edit here and both follow.
//
// Written to stand alone, since a tip is read out of context in the menu. Nothing
// refers to "this mode" or to where the reader is.
export const TIPS = [
  'Set the coarse ×9 / ×6 buttons first to get near the target, then fine-tune with the ×1 / ×2 buttons.',
  'Swipe to 0 or 9 to reset a button in a single gesture instead of tapping through.',
  'In Accuracy, plan your route before you touch anything — every extra move costs you.',
  'In Speed, go for whichever target sits closest to the current sum — fewer moves means more of the ring left, and the ring is what feeds your combo.',
  'Trainee has no timer and no lives — use it to learn how the weights behave before chasing scores.',
] as const satisfies readonly [string, ...string[]]

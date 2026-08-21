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
  'A button on 9 goes to 0 in a single tap — quicker than swiping there.',
  'Every button tops out at nine times its weight: 81 on the ×9, 9 on a ×1. Knowing the ceilings is what tells you which button can close a gap, and in how few moves.',
  'The dial maxes out at 324, every button on 9. Worth remembering — it places a target in the range the moment you read it.',
  'Come back to Trainee once you have been scoring a while. It is the only place to take a route apart with no run riding on it.',
  'Open a session on an easier difficulty. The first run is a warm-up, and the weights come back slower than you remember them.',
  'Chain your hits — a streak multiplies your points ×2 → ×4 → ×8. Accuracy counts optimal routes, Speed counts hits with most of the ring left.',
  'Play with two hands, a thumb to each side of the grid. Reaching across for every button is time the ring is already spending.',
  'Learn the nine times table cold. The ×9 button steps 9, 18, 27 and on up to 81, and it is the one that closes the big gaps — knowing that 63 is seven taps from zero saves counting on the spot.',
  'Turn on SHOW SUM IN BUTTONS under Options. Each button then reads out what it is contributing, so the arithmetic sits on the grid instead of in your head.',
  'Think in horizontal swipes before you tap. Left sends a button to 0 and right to 9, and each is one move however far it travels — a big gap is often two swipes and a tap rather than a dozen taps.',
] as const satisfies readonly [string, ...string[]]

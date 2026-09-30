# The curtain and the stepper

A first launch currently goes splash → tutorial, with the run dealt as the logo
begins to leave. Two changes to that:

1. A **curtain** between the two — a plain screen saying `LET'S LEARN THE GAME`,
   which the tutorial then fades up through.
2. A **stepper** across the top of every tutorial run — five numbers and two
   arrows — that lets the player go back to a board they have already played and
   return to where they were. It cannot be used to skip ahead.

## What a step is

One step per fixed board the tutorial deals, so five: `TUTORIAL_TARGETS` is the
list, and step _n_ is the board standing when the run's hit count is _n − 1_.

| Step | Target | What it teaches                       |
| ---- | ------ | ------------------------------------- |
| ①    | 204    | the opening, guided one key at a time |
| ②    | 211    | the first board played alone          |
| ③    | 202    | the swipe down                        |
| ④    | 24     | the swipe left                        |
| ⑤    | 216    | the swipe right                       |

The three cards on the opening board — the target tip, the sum tip, the guided
route — share step ①; they are beats of one board, not boards of their own. The
sign-off (`THAT IS EVERY MOVE — LET'S TRAIN`) has no number either: it answers
the hit that clears ⑤ and has a rolled board behind it, so there is no board for
it to be a step of. Past ⑤ the stepper shows all five behind the player, with
PREV still live and NEXT dark.

Nothing about the lesson's own script changes. `machines/tutorial-lesson.ts`
already maps a hit count to the step it opens, and rewinding reuses that map
rather than adding a second one.

## The curtain

A new `components/tutorial-curtain.tsx`: a full-viewport view on the app's
surface token with one centred line in the app's mono caps, in the tutorial's
blue (`MODE_GRADIENT.trainee[0]`).

The surface, not `#FFFFFF`. In light it is the app's own warm off-white
(`#f3efe9`) and in dark it is `#0b0c14`, so the curtain is the same ground the
game is about to be drawn on — which is what makes the hand-off a fade of the
words rather than a change of background. A literal white would flash on a
dark-mode launch and then have to fade back down to a dark board.

Copy: `LET'S LEARN THE GAME`, through `msg` like everything else the player
reads, with a Czech string alongside it.

### The sequence

The welcome run is dealt today as the splash _begins_ its exit, so the fade
uncovers a game already in motion. The curtain takes that slot, and hands the
same trick on:

1. The splash begins its exit. The curtain mounts at full opacity underneath it.
2. The splash finishes and unmounts. The curtain is what is left.
3. It holds ~1.4s, or until the player taps it.
4. It fades out over ~500ms. `startTutorial('welcome')` fires as the fade
   **begins**, so the board is dealt and the first target has sprung in by the
   time the words have gone.

A new `LAYER.curtain` at 50 — over every screen and dialog, under the splash at
100, which is the order the sequence above needs.

### Which runs get one

The welcome only. TRY IT at the end of How to Play deals the tutorial with no
curtain: that player has just finished reading the guide and pressed a button
asking for the run, and a screen telling them they are about to learn the game
is one more thing between them and it. The dev sidebar's door gets none either.

## The stepper

A new `components/game/tutorial-stepper.tsx`, rendered only while
`context.tutorial` — a fixed-height row between the run header and the banner
band:

```
  ‹        ①  ②  ③  ④  ⑤        ›
```

Fixed height for the same reason the banner band is held open: it sits above the
spawn canvas, and a row that came and went would resize the canvas under a target
already placed in it.

Three states for a number:

| State   | Looks like              | Tappable |
| ------- | ----------------------- | -------- |
| current | filled, tutorial blue   | no       |
| visited | outlined, tutorial blue | yes      |
| locked  | dim, no outline         | no       |

PREV is live while the current step is above ①. NEXT is live only while the
current step is below the furthest reached — which is the whole of the
no-skipping rule, and the reason NEXT is dark for a player who has never gone
back.

`furthest` is a high-water mark held beside the lesson: seeded from the run's
`hits` when a run is dealt or restored, and raised by play, never by a rewind. A
saved tutorial put back mid-run therefore gets a stepper with everything up to
its hit count already behind it, and nothing new has to be persisted for that.

## Rewind

A new event on the game machine:

```ts
| { type: 'REWIND'; board: number; now: number }
```

`board` is zero-based — the hit count the run is being put back to, so the
stepper's ① is board 0 and ⑤ is board 4. The same number indexes
`TUTORIAL_TARGETS`, `scriptedTarget` and `LESSON_AFTER_HIT`, which is the point
of counting it that way rather than from one.

Accepted in `playing`, and guarded to `context.tutorial` so it is inert in every
other run. It assigns:

- `hits` — the board index
- `grid` — `tutorialBoardEntry(board)`, below
- `targets` — one target carrying `scriptedTarget(board)`, dealt here rather than
  left to the spawner, which only ever deals into a cleared board and so stays
  quiet
- `nextTargetId` — bumped, so the arriving target is not confused with one still
  animating off
- `hitBatch` — hits emptied, seq kept, exactly as `freshGame` does

Score, streak and the run clock are left alone. A tutorial submits nothing and
shows no score, so there is nothing for a rewind to inflate.

### The board a rewound step stands on

`tutorialBoardEntry(n)`, a pure function beside the rest of the tutorial's
numbers:

- `n === 0` → `TUTORIAL_OPENING_GRID`
- otherwise → the grid reached by applying `computeKeyPlan(previous,
TUTORIAL_TARGETS[n - 1])` to the previous entry grid, setting each key in the
  plan to its `to`.

Derived rather than recorded. The alternative was a ledger snapshotting the grid
each board was entered on, which is faithful to the player's own route but is new
state that has to ride along in the saved run — and a restored run could then
offer PREV only as far back as its ledger happened to reach. Deriving costs the
player's particular route and buys a rewind that is pure, testable, identical on
every device, and unaffected by a restore. It also puts them on exactly the board
each lesson was written against, which is the board the lesson's words are true
of.

### What the lesson does about it

`useTutorialLesson` sets its step directly on a rewind, to `LESSON_AFTER_HIT[n]`
— the same table a hit already opens its lesson from. Its index 0 is `waiting`,
which the code today notes is never read because no hit lands at nought; a
rewind to board 0 is the one thing that reads it, and it is already the right
answer. The note goes.

Set rather than sent through `lessonStep`, which short-circuits at `done` and
would otherwise swallow a rewind out of a finished script. The pure script needs
no change.

## Testing

- `tutorialBoardEntry` — each entry grid weighs exactly the target of the board
  before it, and board 0 is the opening grid.
- The `REWIND` reducer — moves `hits`, `grid` and `targets` together; is a no-op
  in a run that is not a tutorial.
- The stepper's rules — PREV and NEXT enablement, and which numbers are tappable,
  against a current/furthest pair.
- A pin holding the stepper's count to `TUTORIAL_TARGETS.length`, beside the
  existing one holding the lesson's own list to the same length.

## How to Play

No change. The guide describes the game's controls and modes; the stepper is a
control on the tutorial run itself, and the guide's only word about the tutorial
is the TRY IT button that deals one. Re-checked at the end of the work rather
than assumed.

## Out of scope

- The curtain on any door but the welcome.
- Any change to what the lesson says, the boards it deals, or their order.
- Persisting the furthest step separately from the run's hit count.

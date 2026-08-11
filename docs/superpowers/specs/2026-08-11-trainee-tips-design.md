# Trainee Tips — Design

Date: 2026-08-11

## Goal

Trainee's slot in the menu is empty. Accuracy and Speed show a difficulty
selector and the leaderboard there; Trainee, which is where a new player starts,
shows nothing at all — so the mode that most needs teaching is the one that says
the least.

Fill that slot with the game's tips, one at a time.

## Where it goes

`components/overlays/menu-overlay.tsx`, panel 0 (ALONE), directly where
`HighScores` renders for the other modes — beneath the mode selector, above the
PLAY button. Two blocks there are already gated on
`isOneOf(focused, ['accuracy', 'speed'])`; this is a third gated on
`focused === 'trainee'`.

Arcade keeps showing nothing. It is not playable yet, and this change is about
Trainee.

## Presentation

One tip at a time, rotating every 6 seconds, with page dots beneath.

A full list was the alternative. At the slot's width — `max-w-3xs`, about 256px
— five prose tips run long enough to push PLAY down the screen or to nest a
scroll inside a screen that already scrolls. One at a time fits, and reads as an
invitation rather than a wall of text.

Rotation is automatic rather than tap-to-advance, so the tips are seen without
being asked for. The cost is that a tip can rotate away mid-read, which the dots
mitigate: they take `onSelect`, so tapping one jumps to that tip and restarts the
timer.

Swiping the card changes the tip: left goes forward, right goes back, both
wrapping, so a swipe never meets an end that refuses to move. It reuses the
`SWIPE_THRESHOLD` the dial already swipes by, so the gesture feels the same
everywhere in the app, and it follows the dial's idiom — `Gesture.Pan().onEnd`
with `scheduleOnRN` to cross back to JS. The menu's ALONE / WITH FRIENDS panels
are driven by their tabs rather than by a pan, so nothing competes for the
horizontal drag.

The transition carries a 16px directional slide alongside the fade: a swipe that
produced a pure cross-fade would read as a tap. The timer and the dots animate
the same way, with "forward" matching the direction a swipe-left sends things,
so the panel only ever moves one way for one meaning.

Every route to another tip — timer, dot, swipe — goes through one function, which
is what guarantees they all cancel the pending rotation and all re-arm a full
dwell on arrival. Two details fall out of that. A swipe landing in the last
moments of a dwell cannot be followed by the rotation firing on top of it,
because the timer is cleared before the fade starts. And a second swipe part-way
through a transition retargets it rather than being dropped, so the tip that
appears is the one last asked for rather than one already swiped past.

The text sits in a fixed-height box, vertically centred, and the box clips: the
departing tip slides within the card rather than drifting out over the border. Tips differ in length
and this panel sits directly above the PLAY button, so without a floor the button
would hop every six seconds. The cost is whitespace under the shorter tips, which
is the better of the two problems.

The cross-fade is built the way the what's-new dialog already closes —
`withTiming` to 0, `scheduleOnRN` to swap the index at the trough, `withTiming`
back to 1 — 200ms each way, `Easing.in` leaving and `Easing.out` entering per the
design guide.

## The border, and the dots hanging off it

The panel wears the what's-new dialog's edge at half weight — 1px rather than 2px
and radius 20 rather than 26, because this is a 256px panel and not a full-width
sheet.

Where that dialog needs a padded-gradient sandwich (React Native has no
`borderImage`), this is a plain `borderWidth`: the edge is one flat colour, so
there is no gradient to fake. React Native draws borders inside the box, so the
line still ends exactly at the card's bounds and the dots' offset below is
unaffected.

Border and dots share one hue, `MODE_GRADIENT.trainee[0]`. That is the trick
rather than a coincidence: the dots hang on the border's centreline, so a shared
colour is what makes the row read as the border going dotted instead of as a
meter parked on top of it.

The line alone is held back to a third alpha, so it frames the tip without
competing with the mode selector above it, while the dots stay solid because they
are the control and want to be seen. The alpha rides on the colour rather than on
an `opacity` style, which would take the card and its text down with the border,
and it is one constant to tune.

The dots do not sit under the card. They hang off its bottom edge, their row
centred on the border's centreline, so half the row is inside the card and half
outside and the dots read as the border itself going dotted. A narrow
surface-coloured strip behind the row is what breaks the line, and it is
invisible from either side because the card's interior and the screen behind it
are both `bg-surface`.

The dot shapes are exactly as they were — 6px circles, a 20px pill for the
current one, `px-1 py-2` hit targets — but two things about them change.

**Colour.** Every dot takes the same tone rather than filling up to the current
one. Progress means nothing on a sequence that loops back to the start, and a row
of grey-and-coloured dots reads as a meter sitting on the border rather than as
part of it. The stretched dot still says which tip you are on. The tone is the
border's, `MODE_GRADIENT.trainee[0]` — see above.

**Movement.** The width animates between the two sizes instead of snapping, so a
rotation reads as movement along the row rather than as two dots blinking
independently. That needs each dot to hold its own shared value, which means its
own module-level component — declared inside the row's `map` it would remount
every render and the stretch would never play. Hence `components/page-dot.tsx`.

Two supporting details. The row's height is a constant rather than measured,
because it decides where the row hangs and `onLayout` would land a frame late —
the dots would visibly drop onto the border after the panel appeared. And the
full-width positioning wrapper is `pointerEvents="box-none"`, so it cannot
swallow a press meant for what sits below it.

`PageDots` gives up its own `mt-3` for this: spacing belongs to the caller once
one caller hangs the row off a border. The what's-new dialog wraps it in a
`mt-3` View, which leaves that dialog pixel-identical.

## Content

One shared list in `constants/tips.ts`, read by both the guide and this panel.
Two copies would drift, and CLAUDE.md already requires the guide to be kept
current — one place to edit is what makes that rule cheap to follow.

`TIPS` is a non-empty tuple of plain strings, `as const`, so indexing stays
type-safe under `noUncheckedIndexedAccess`. Strings rather than objects: the
guide's `Bullet` already takes `children: string`, and every tip shares one
accent, so per-tip icons would be invented complexity.

The five tips currently hardcoded in `how-to-play-overlay.tsx:364-382` move over
verbatim, except the last. "Start in Trainee to build intuition for the weights,
then chase high scores" reads oddly when displayed inside Trainee, so it becomes
advice that works in both places without the self-reference.

The guide then maps over `TIPS` instead of listing `<Bullet>` elements. Nothing
else about its rendering changes.

## Colour

`#FF8C00` — already `ACCENT.tips` in the guide, and the arcade amber that closes
the game scale. Reusing it keeps tips one colour wherever they appear, and per
the design guide this is a whole-app concern rather than a mode one, so it takes
no `MODE_GRADIENT`.

## Files

```
constants/tips.ts                          the shared list
components/overlays/mode-tips.tsx          the rotating panel
components/overlays/menu-overlay.tsx     + the trainee branch
components/overlays/how-to-play-overlay.tsx  map over TIPS
```

No new dependency. `PageDots` and the Reanimated idioms already exist.

## Testing

Nothing here is pure logic worth a Vitest file — a constant array and a timer.
Per the code guide, components and hooks are unit tested only when the behaviour
is non-trivial, and this is neither.

Verified instead by `pnpm check` and by eye: select Trainee in the menu and watch
the tip change, tap a dot to jump and confirm the timer restarts, then open the
guide and confirm the same five tips are listed there.

## Known rough edges

Both accepted rather than fixed, and both cheap to revisit:

- `PageDots` fills every dot up to the current one, which reads as progress.
  That suits the linear what's-new pager; on a loop that resets to a single
  filled dot it is slightly odd.
- The rotation timer keeps running while the WITH FRIENDS panel is showing,
  because the ALONE panel stays mounted beside it. Harmless — nothing is
  visible and no work of consequence happens — but it is a timer doing nothing.

## Not touched

Controls, targets, timers, modes, difficulty, scoring, streaks and lives are all
unchanged; the guide's content is the same five tips, one reworded. The guide
itself is edited here, so the CLAUDE.md rule is satisfied by construction.

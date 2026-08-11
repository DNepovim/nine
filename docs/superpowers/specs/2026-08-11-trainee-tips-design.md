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

The cross-fade is built the way the what's-new dialog already closes —
`withTiming` to 0, `scheduleOnRN` to swap the index at the trough, `withTiming`
back to 1 — 200ms each way, `Easing.in` leaving and `Easing.out` entering per the
design guide.

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

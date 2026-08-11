# Live Record Announcements — Design

Date: 2026-08-11

## Goal

When a player takes a board record, everyone else mid-run should hear about it
**at that moment** — the same moment the achiever's own animation fires — rather
than whenever that player's run happens to end.

## The gap

The two halves of a record are wired differently today.

**The achiever** is served locally. `useAnnouncements` snapshots the board
records at run start and compares the live score against that snapshot on every
change, so the celebration is instant and needs no network.

**Everyone else** is served by the database. `useRivalRecords` subscribes to
`postgres_changes` on `scores` and `daily_scores`, refetches the leaders on any
nudge, and diffs two leader snapshots to decide what to announce. Those rows are
written only by `submitScore`, which runs on game over or when the player leaves
a run.

So the trigger for everyone else is the write, and the write waits for the run to
finish. A long Speed run can sit on a new all-time record for minutes with nobody
told.

## Approach

Publish the score the moment a board record is crossed. Rivals then learn through
the pipeline that already exists — realtime nudge, leader refetch, snapshot diff.

Rejected: **broadcasting a realtime message** with the record in its payload.
It needs a new channel and dedup against the later database write, and it breaks
the invariant `useRivalRecords` is built on — the payload is deliberately never
read, only used as a "something moved" nudge, so a partial row can't fool it.

It is also less correct. The achiever's check runs against a snapshot taken at
run start, so they can "cross" a record a third player has since raised. Writing
to the database makes that misfire harmless, because the rivals' diff is
authoritative and simply shows no change. Broadcasting the claim would announce a
record that is no longer one.

Also rejected: submitting on a timer through the run. Many more writes, and the
announcement stops being tied to the moment it describes.

## Why publishing mid-run is safe

Two properties, both verified rather than assumed:

- **Score is monotonic within a run.** `machines/game.ts:263` only ever adds, and
  the multiplier is at least 1, so a later write from the same run is never
  lower.
- **The database refuses downgrades anyway.** `prevent_score_downgrade`
  (`supabase/migrations/20260722000000_init.sql:42-56`) fires `before update` on
  both `scores` and `daily_scores` and silently keeps the existing row when the
  incoming `best_score` is lower.

A player who takes a record and then dies keeps the score. That is correct: they
reached it.

## Only board records publish

A personal best concerns nobody else, so crossing one must not write. Only the
three board tiers — `today`, `week`, `ever` — do.

`lib/announcements.ts` gains a pure predicate over the ids a score just crossed,
covered in the existing `lib/announcements.test.ts`. Keeping the rule in `lib/`
rather than inline in the hook is what makes it testable, matching `rivalChange`
and `crossedRecords` beside it.

## Wiring

`useAnnouncements` already computes the crossed ids and tracks which have fired.
Today it takes the first unfired one; it will instead build the freshly-crossed
list explicitly, so it can both pick the one to announce and ask whether any of
them was a board record.

When one was, it calls a new `onBoardRecord` prop. That prop is held in a ref,
the way `useRivalRecords` holds `refresh` — the effect keys on `[inRun, score]`
and must not re-run merely because the parent re-rendered with a new callback
identity.

`app/(tabs)/index.tsx` passes a callback that calls the existing
`submitScore(mode, difficulty, score, hits)`. That function is already
fire-and-forget, already refuses trainee and non-positive scores, and already
queues for retry when offline — so the mid-run call needs none of its own error
handling.

The end-of-run submission stays exactly as it is. It is what records the final
score and corrects the partial `hits` written mid-run.

## Accepted consequence

A player who takes a record early and keeps scoring writes twice, so rivals can
see "ANNA now leads today" at the crossing and again when her run ends with a
higher score. Both are true, and the existing 15-second throttle in
`useRivalRecords` stops any burst — but it is more chatter than the single
message today.

Shipped as-is. A per-rival, per-period cooldown would suppress the second
message, but there is no evidence yet that it needs suppressing, and the second
message does describe a real further increase.

## Files

```
lib/announcements.ts        + test   the board-tier predicate
hooks/use-announcements.ts          fresh-crossing list, onBoardRecord
app/(tabs)/index.tsx                pass the callback
```

No schema change, no new channel, no new dependency.

## Testing

Extends `lib/announcements.test.ts`: a personal best alone does not publish, each
board tier does, a mixed crossing does, and an empty list does not.

The hook and the wiring are not unit tested, matching the code guide — pure logic
is always tested, hooks only when the behaviour is non-trivial.

Verifying by hand needs two devices on the same board: take a record on one and
watch the other's bar announce it without ending the run.

## Not touched

Nothing here changes controls, targets, timers, modes, difficulty, scoring,
streaks or lives — what a record _is_ has not changed, only when it is
published — so `components/overlays/how-to-play-overlay.tsx` stays as it is.

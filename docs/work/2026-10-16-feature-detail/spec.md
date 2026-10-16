# A feature, and who reaches it

Slug: feature-detail
Stage: shape
Next: /spec feature-detail
Track: full
Branch: feat/feature-detail
Started: 2026-10-16

## Problem

The FEATURES tab says how many roles hold each key and how many people end up with it, and
those two figures are the end of what it will tell you. An admin who needs to know _which_
people has to go to the person screen and already know whose name to type; an admin who
needs to take a feature off somebody has to find them the same way. The one thing the tab
can change — visibility — is set from a window that shows a key and three words and
nothing about who the change would move.

And the rule underneath it does not match what anybody expects of the word **public**. A
feature revoked for one person by hand stays revoked when it goes public, because an
override wins outright. The intent was that a hand-set instruction about one person should
survive the feature going out — but it means "public" does not mean everybody, and the one
place that says so is a paragraph in a migration.

## Appetite

**A week.** A new screen, a new read, a change to the resolution rule every launch depends
on, and two rows of `CLAUDE.md` that currently state the opposite of what will be true.

## Shape

The admin opens FEATURES and presses a row. The detail names the key, says what the note
says, and carries the visibility control at the top — the three-position pill that used to
live in a window of its own, now on the screen that can show what moving it does.

Under it, for a **private** feature, who reaches it:

- **The roles whose stack holds it.** One row each.
- **The people who reach it.** One row each, marked with where it comes from — a role they
  hold, or an override set on them by hand.

Either list lets a row be taken away. Removing a role's entry is the ROLES tab's write, made
from here. Removing a person's is their override, cleared — which drops them back to
whatever their role says, and that is the honest result rather than a revoke.

A **public** feature shows no people list at all. The answer is everybody, and a list of
everybody is not a list. The visibility pill stays, so the way back to private is here.

And public starts meaning what it says: a public feature reaches everyone, whatever any
override says. The revoke row is left where it is rather than deleted — it still means
something if the feature ever returns to private.

### Areas

- **Schema** — `effective_features`, the one function every launch reads, gains `public` in
  front of the override instead of behind it. One line, enormous blast radius.
- **A new read** — who holds one feature, with where each person's claim comes from. There
  is no such RPC today: `feature_stats()` counts, and `person_features(uuid)` answers the
  other way round, one person across all features.
- **Lib** — `lib/admin/features.ts` gains the read and the two removals.
- **Screens** — a new detail file; `admin-features.tsx` makes its rows pressable; the
  existing `admin-visibility-modal.tsx` either moves onto the detail or stays as the
  control it already is.
- **Docs** — `CLAUDE.md`'s **visibility** and **override** rows both state the current rule
  explicitly and both become wrong.

Not a mode's business and not the engine's. No run, no rules, no capability.

**No feature of its own.** It is part of the `admin` screen, which is pinned to private by
a check constraint in both directions.

## In

- A detail screen per feature, reached by pressing its row.
- Visibility set from there.
- For a private feature: the roles holding it, and the people reaching it with their source.
- Removing a role's grant and clearing a person's override, both from there.
- Public beats an override. A public feature reaches everybody.
- The two `CLAUDE.md` rows rewritten, and the migration's rationale corrected.

## Out

- **A people list for a public feature.** The answer is everybody.
- **Granting from here.** This screen takes away; the person screen is where a feature is
  given to somebody by hand, and it already does that well.
- **Editing the note.** It is set with the visibility today and can stay there.
- **Deleting a revoke row when a feature goes public.** It stops applying; it is not wiped.
  Wiping it would lose the instruction if the feature ever went back to private.
- **Paging the people list.** A private feature reaches a handful of people by definition.
  A list that needs paging is a feature that should be public.

## Rabbit holes

- **A revoke that stops applying is invisible state.** After this, a person can carry a
  revoke row that does nothing, and nothing on the person screen will look different. If
  the feature returns to private it bites again, and the admin who made it public months
  ago is not the one who will be confused. The detail should show these — a person revoked
  under a public feature is exactly the row worth drawing — and `spec` should decide
  whether the person screen says so too.
- **`guard_admin_floor` exists for a reason.** `set_feature` calls it, and nobody can take
  `admin` from themselves. Removals made from this screen have to go through the same
  floor, or the last admin can be removed from `admin` by a screen that was not thinking
  about it.
- **`admin` cannot be made public.** A check constraint refuses it in both directions. The
  pill on this screen must not offer the position — a control that raises on press is worse
  than one that is absent.
- **Two screens editing one row.** Removing a role's feature here is the same write the
  ROLES tab makes. Both need the same guard and the same refresh, or one will show a stale
  stack after the other has changed it.
- **The blast radius of one line.** `effective_features` decides what every player sees on
  every launch. The change is additive — people gain features, nobody loses one — but it is
  the function to get wrong least, and `spec` should name how it gets tested before it is
  pushed.

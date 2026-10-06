# Feature flags in the database — Verification Guide

Date: 2026-10-06

**The four lockout guards are the ones that matter.** A mistake anywhere else on
this page is a wrong number on a screen three people see. A mistake in these is an
app with nobody able to open the admin screen, and no way back in but SQL.

All four are covered by `supabase/tests/features.sql` and pass there. This page is
for the half the test suite cannot reach: the screens, which were written by reading
rather than rendering — Vitest runs in `environment: 'node'` and this repo has no
component tests. The `2026-10-02-arcade-siege-verification.md` precedent applies.

## The four, first

1. **Take `admin` off yourself by role.** PEOPLE → yourself → ROLE → NONE. It must
   refuse, print _that change would take admin away from you_, and leave you on the
   screen with the picker still showing ADMIN.
2. **Take `admin` off yourself by override.** PEOPLE → yourself → tap the `admin`
   row until it would read override, off. Same refusal, and the row must snap back
   to "from role" rather than staying where the tap put it.
3. **Take `admin` out of your own role's stack.** ROLES → ADMIN → tap `admin` off.
   Same refusal.
4. **Switch the `admin` feature off.** FEATURES → the `admin` row. The ON pill must
   not be tappable at all, and the key must be drawn with 🔒.

## The resolve

5. A person with no role and no overrides: feature count 0, and every row on their
   person screen reads "from role", unfilled.
6. Give somebody TESTER. Their count goes to 1 — `dev` — because `multiplayer` is
   inactive even though every stack holds it.
7. Switch `multiplayer` ON from FEATURES. The same person's count goes to 2 without
   anybody touching their role. This is the whole point of the switch, and the
   reason the grants were seeded alongside the off switch.
8. Switch it back off.
9. Override `arcade` on for a tester. The row reads "override", the count rises, and
   the PEOPLE list shows ✦ beside them.
10. Override `dev` off for that same tester. The count falls, and the row still reads
    "override" — the source, not the state.
11. RESET TO ROLE DEFAULTS. Both rows go back to "from role", the ✦ disappears from
    the list, and the button greys out.

## Roles

12. Make a role from the ROLES tab. The key derives from what you typed — lower case,
    dashes for spaces — and the label is what you typed, uppercased.
13. Give it a feature, assign somebody to it, then try to delete it. It must refuse
    and say **still held by 1 person**, not a constraint name.
14. Move that person off, then delete it. The role goes and its stack goes with it.
15. Rename a role by editing the heading and tapping away. The list behind it shows
    the new label. (Renaming is a blur, not a press — there is no button here.)

## The app itself

16. **Cold start as a player with no role.** The intro has no DEV and no ADMIN link,
    no WITH FRIENDS tab, and the ARCADE pill is there wearing SOON and unpressable.
17. **Cold start as an admin.** All of the above appear — a moment _after_ the intro
    paints, not before it. That flicker is deliberate; see `hooks/use-flags.tsx`.
18. **Aeroplane mode, cold start.** The intro paints, the doors stay shut, nothing
    errors. A failed `my_features()` is an ordinary player.
19. **Change somebody's role, then have them relaunch.** The change takes effect on
    the next start and not before.
20. **The dev gallery** (`dev/gallery.tsx`) shows the intro with every door open,
    including WITH FRIENDS — which it did _not_ before this change, because `admin`
    never reached a feature floored at `nobody`.

## Analytics

21. An admin's events must not reach PostHog. `setAdminOptOut` asks the feature now
    rather than the role, so check that somebody holding `admin` by **override** is
    also opted out.
22. Open the admin screen and move between its three tabs. `admin.tab` fires; no
    event fires twice for one press.

## The thing most likely to be wrong

23. **Watch the intro settle on a slow connection.** The feature set arrives after
    auth, and `sameFeatures` is what stops a new `Set` with the same keys from
    re-running the analytics effect on every render. If `identify` is firing in a
    loop in the PostHog debugger, that is this.

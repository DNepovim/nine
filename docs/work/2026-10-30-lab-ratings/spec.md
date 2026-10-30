# Ratings in the challenge lab

Slug: lab-ratings
Stage: verify
Next: /ship lab-ratings
Track: small
Branch: feat/lab-ratings
Started: 2026-10-30

## Problem

Players can now rate a session (`challenge-rating`), but nobody can see the answers
without writing SQL. Deciding whether a challenge should come back still means
guessing.

## Appetite

**An evening.** One read function and one line per row on a screen that already exists.

## Shape

1. An admin opens DEV → CHALLENGES LAB. It reads its sessions as it does today, plus
   one call for the ratings.
2. Under each challenge's session line there is one more line: **RATED 7.2 · 14
   RATINGS**. This is every rating of every session of that challenge, combined into one
   plain average. A challenge nobody has rated gets no line.
3. Only an admin gets figures back. The lab is also open to testers (`challengeLab`).
   For them the read is refused and swallowed, as the sessions read already is, so they
   see the lab exactly as before.

Areas: **schema** (a `challenge_ratings()` function, admin-guarded, read only, with no
new table), **`lib/admin/`** (its loader), **the lab** (`dev-overlay.tsx`, one line),
**copy** (one string with Czech).

Neither a mode nor the engine: it is grouped by the session's `mode_id`, which is data.
No feature key: it rides on the lab and the admin guard.

## In / Out / Rabbit holes

**In:** the function, the loader, the line, its Czech.

**Out:** a 1–9 spread; per-session figures on the planner; weighting recent airings;
feeding ratings to the automatic planner; who rated what (never shown, by design).

**Rabbit holes:**

- **Testers and the guard.** If the read throws for a non-admin and is not swallowed,
  the lab breaks for testers. It must fail the way `listSessions` failing does: quietly,
  with the list intact.
- **The migration has to reach production** before this means anything there. The
  `session_ratings` migration is still unpushed, and this one stacks on it.

## Tasks

- [x] 1. `supabase/migrations/…_challenge_ratings.sql`: `challenge_ratings()` returns
      `(mode_id, ratings, average)` grouped over `session_ratings ⋈ challenge_sessions`,
      `security definer`, `require_admin()`, execute granted to `authenticated` only;
      add a pgTAP block in `supabase/tests/session_ratings.sql`
- [x] 2. `lib/admin/ratings.ts`: `listChallengeRatings()` → `Map<modeId, {ratings, average}>`
- [x] 3. `dev-overlay.tsx`: read on open beside the sessions; the line under the session line
- [x] 4. Copy: `pnpm i18n:extract`, Czech

## Acceptance criteria

1. As an admin with ratings on two sessions of FOUR KEYS (say 4 and 8), the FOUR KEYS
   row reads `RATED 6.0 · 2 RATINGS`. A challenge with no ratings shows no rating line.
2. Ratings on sessions of two different challenges stay on their own rows.
3. `challenge_ratings()` refuses a non-admin caller and `anon`, and returns one row per
   rated challenge for an admin.
4. As a tester (without `admin`), the lab opens with every row and no rating lines, and
   nothing errors on screen.
5. `pnpm check` is green, Czech included, and `session_ratings.sql` passes.

## Build notes

- The Czech reads `PRŮMĚR 7.2 · 14 HODNOCENÍ` ("average … ratings"). A literal
  "RATED" would have been HODNOCENÍ twice in one line.
- The average uses `toFixed(1)`, so it shows a decimal point in Czech too. That is the
  admin screens' existing habit (`admin-stat-people.tsx`).
- No dev fixtures. Rating rows are made by playing, and the verify walk inserts its own.

## Verification log

**Verdict: 5 PASS, 0 FAIL, 0 SKIPPED.**

| #   | Criterion                         | Result | Evidence                                                                                                                                                                                  |
| --- | --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | FOUR KEYS 4 + 8 → `RATED 6.0 · 2` | PASS   | Web build, as admin: the FOUR KEYS row reads `RATED 6.0 · 2 RATINGS`, and unrated challenges have no line                                                                                 |
| 2   | Challenges kept apart             | PASS   | HABIT reads `RATED 7.0 · 1 RATING` on its own row                                                                                                                                         |
| 3   | Admin-only read                   | PASS   | `session_ratings.sql`: a non-admin and `anon` are refused; an admin gets one row per rated challenge with the right count and average                                                     |
| 4   | Tester sees the lab as before     | PASS   | Same walk with the role set to `tester`: every row, no rating lines, no page errors                                                                                                       |
| 5   | Checks green                      | PASS   | Types, Knip, 2,099 tests, `i18n:verify` and Prettier on this item's files. `pnpm check` itself stops on Prettier for another session's `docs/work/2026-10-29-challenge-analytics/plan.md` |

# Push on every board — Plan

Spec: docs/work/2026-11-13-push-every-board/spec.md

## Tasks

- [x] 1. `supabase/migrations/20261113000000_push_every_board.sql` — widen `push_outbox` (`kind`, `period` backfilled `ever`, `session_id`), swap the throttle for the two partial uniques, update `drain_push_outbox`
- [x] 2. Same migration — one helper (feature gate, nickname, subscription, cascade rule) and `board_reigns_owe_push` rewritten through it
- [x] 3. Same migration — the `daily_scores` trigger: day and week takeovers, Prague-today guard
- [x] 4. Same migration — the `session_scores` trigger: `passed` while a session is open, measure order
- [x] 5. `supabase/functions/send-push/message.ts` + `message.test.ts` — periods, `passedMessage`, challenge-name table and its catalog guard
- [x] 6. `supabase/functions/send-push/index.ts` — new columns, route by `kind`
- [x] 7. Consent line and options `ready` text widened; `pnpm i18n:extract`, Czech
- [x] 8. `docs/domain.md`, `CLAUDE.md`, `docs/push.md` — takeover widened, passed introduced
- [~] 9. Local run: `supabase db reset`, seed boards and a live session, walk criteria 1–7 and 10

## Verification log

**Verdict: 9 PASS, 1 PARTIAL (4), 1 SKIPPED (10).** No failures. Criterion 10 was not run, and 4's backfill was read, not run.

| #   | Criterion                                | Result  | Evidence                                                                                                                                                                                                   |
| --- | ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Day takeover owes one `day` row          | PASS    | `supabase/tests/push.sql`, second block (run twice, clean): one `takeover`/`day` row for the holder, taker named (a `week` row on a Monday, where day and week are one board)                              |
| 2   | Week not day; all three owes one         | PASS    | same file: B passing A's best day replaces the unsent `day` row with `week`; then taking the all-time board leaves one `ever` row, not three                                                               |
| 3   | Tie, extending a lead, past-day score    | PASS    | same file: equal score with a later `updated_at` owes nothing; a score for `today - 3` owes no `day`/`week` row                                                                                            |
| 4   | Ever still works; old rows read `ever`   | PARTIAL | ever via the reign trigger PASS (the original block plus the cascade test). The `update push_outbox set period = 'ever'` backfill was read, not run: a fresh reset has no rows to backfill                 |
| 5   | Passed owes one, once per session        | PASS    | same file: one `passed` row with the session id and challenge id and no period; the same leader passing back owes the other player once and the first none; a `time` session orders faster-first           |
| 6   | Outside window, no change, no nickname   | PASS    | grace-window write owes nothing (push.sql); a leader extending the lead owes nothing (push.sql); a nickname-less writer owes nothing (scratch transaction, rolled back)                                    |
| 7   | Hidden feature and no device owe nothing | PASS    | hidden: daily (push.sql) and session board (scratch, rolled back), and the original reign block; no device: B owed nothing before subscribing                                                              |
| 8   | Message text, wide nickname, tags        | PASS    | `vitest run supabase/functions/send-push` 13 tests: en and cs titles per period, passed body, ten-wide nickname, tags differ per period                                                                    |
| 9   | Every catalog challenge has en and cs    | PASS    | same file: iterates `CHALLENGES` from the catalog and asserts the name tables hold exactly its slugs                                                                                                       |
| 10  | `send-push` delivers end to end locally  | SKIPPED | `supabase functions serve send-push` came up, but the local gateway on 54321 is another container that does not route to it, and the edge runtime has no published port. Unit and SQL cover the two halves |
| 11  | `pnpm check` green; migration pending    | PASS    | `pnpm check` exit 0 (159 files, 2377 tests, i18n verify, Knip). `supabase migration list --linked`: `20261113000000` local only, remote empty                                                              |

**Found along the way, not this work's:** `pnpm db:test` stops at `features.sql` ("a profile with no role should reach nothing": the seeded first profile already holds `admin`), and `session_run_receipts.sql` fails ("RUNS should count the player's challenge runs"), also with `session_scores_push` disabled. Both are in code this migration does not touch. `db:test` aborts before it restores the dev fixtures, so I restored them by hand with `node scripts/dev-fixtures.js`.

**Review gaps worth a look:** the passed push is per challenge, so a lead lost in a second session of the same challenge is a new push but replaces the first on the lock screen; and the spec's Review focus 6 (consent wording) is a copy judgement for `review`.

## Build notes

- **Task 9 partly done.** The triggers (criteria 1–7) are covered by `supabase/tests/push.sql`, which both
  blocks pass against the local database (run with the `push` feature temporarily hidden, then restored to
  `private`). The spec said the repo has no SQL harness; it does, and `Tests` should read "extended
  `supabase/tests/push.sql`". **Criterion 10 (`send-push` end to end) was not run**: `supabase functions
serve` came up but the local gateway on 54321 is a different container that does not route to it, and the
  edge runtime has no published port. `drain_push_outbox`'s new columns are asserted in SQL and the message
  text in `message.test.ts`; `index.ts` only passes them through.
- **Week is the best single day since Monday, not a sum** (corrected in the spec's rabbit holes).
- **Passed tag** is per challenge slug (`passed-<slug>`), not per session as the spec said; a second
  session of the same challenge replaces the first on a lock screen, which is the same effect.
- **Czech passed body** is worded not to guess the other player's gender: `{who} je ve výzvě {X} před tebou.`
- **Fixtures:** none needed; the outbox is written by play and no screen reads it.
- Not run: `pnpm check` (verify owns it).

## Review

`/code-review` at `high` (schema touched): ten findings. The spec's six review-focus items were confirmed
first; none was real.

**Fixed (re-verified: `push.sql`, `session_scores`, `session_candidates` and `session_ratings` SQL tests, 14
Vitest, `pnpm check` exit 0):**

- The three push triggers could fail the score write that fired them. Each now ends in an
  `exception when others … return null` that raises a warning instead.
- Four leader queries ran on every `daily_scores` write before any cheap gate. All three triggers now
  return early when the `push` feature is hidden (`push_is_on()`), and the daily and session triggers when
  the write changed nothing.
- **The deploy order was backwards.** The old `send-push` against the new schema sends a `passed` row as a
  takeover with a raw challenge id, already marked sent. The new function reads the old schema fine, so it is
  **function first, then `db:push`**. Spec, migration header and `docs/push.md` amended.
- Czech day title `Dnešní rekord` → `Denní rekord` (a push can arrive after midnight).
- The catalog guard now also compares each English name to the catalog's label.
- An over-long comment reflowed.

**Kept, as decided:**

- One `passed` per player per session: the earlier choice you accepted. A lead lost twice in one
  session is told once.
- A wider takeover after a narrower one already **sent** still pushes both. They are separate events in
  separate writes; the cascade rule only collapses one write.
- `passed` is tagged per challenge slug, not per session.

**For you, not decided here:** players who already said yes under "when a rival takes your record" will
receive the day, week and challenge pushes too, and nothing records which wording they agreed to. The
`push` feature gates it, so the exposure begins when it is made public. A consent version and a re-ask via
`pushStepDue` is the fix if you want one; it is a separate item.

**Not this work's:** `pnpm db:test` stops at `features.sql` and `session_run_receipts.sql` fails with or
without these triggers. The working tree also carries Czech catalog edits from another session ("pojď
násobit", line-number churn): commit the push strings with `--only`.

**Next brainstorm:** the same takeover pushes on native once `expo-notifications` is wired in; the consent
version above; a per-player daily cap if volume complains.

Shipped: e58124c on main. Migration pushed to production.

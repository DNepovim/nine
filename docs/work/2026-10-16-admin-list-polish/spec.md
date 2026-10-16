# Legible admin lists

Slug: admin-list-polish
Stage: shape
Next: /build admin-list-polish
Track: small
Branch: fix/admin-list-polish
Started: 2026-10-16

## Problem

The admin tables are read as data, and the data is the faintest thing in them. Every
table has a `tone: 'name'` first column drawn in the primary ink and right-hand columns
with no tone at all, which resolve to the secondary one — so the count, the duration, the
where-from, the figure a reader actually opened the screen for, is greyer than the label
beside it. And the challenges list says LIVE NOW where LIVE would do, and gives a session's
length without ever saying when it starts or how long until it does.

## Appetite

**An evening.** No schema, no new domain word, no new component. One expression in the
shared table, one label, and one row rebuilt.

## Shape

The admin opens any list. The right-hand columns read in the same ink as the names beside
them: a count is a fact, not a footnote. Chips are untouched — they paint themselves, and
the ones that mean something already carry a tone.

On CHALLENGES, a live row's chip reads **LIVE**. The word NOW was doing the work the green
dot beside it already does.

Under a challenge's name, where the length alone used to sit, three facts in the order a
planner wants them: when it starts, how long until it does, and how long it runs. A session
starting in four hours and one starting in four days currently read identically.

Names keep their own colours, and both already have them: a challenge's name is drawn by
`GradientText` in its own pair, and every nickname in these screens already goes through
`GradientName`. Nothing to do for either beyond not breaking them.

### Areas

- **The shared table** — `admin-table.tsx`, the one expression that maps a column's tone to
  an ink. After this, `quiet` means a typography role and not a colour.
- **One label** — `STATUS_LABEL` in `lib/challenge-session.ts`.
- **One row** — the session row's second line in `admin-sessions.tsx`, plus whatever it
  needs from `lib/duration.ts` to say "in 4 h".

## In

- The `quiet` column tone draws in the primary ink, in the owner, once.
- `LIVE NOW` → `LIVE`.
- Start time, time-to-start and duration under a challenge's name.
- Challenge and player colours left exactly as they are.

## Out

- **Captions, hints and dialog copy.** `admin-stats.tsx` has nine greys and none of them is
  a table item; the same goes for every `TYPE.hint` under a field. The request was the
  tables.
- **Chips.** `AdminChip` resolves its own ink from its tone and is not a string cell.
- **A new type role.** This changes which existing role a cell asks for, not what any role
  is — so the typography scale is untouched.
- **Re-ordering or re-widthing any column.** Only the ink and the one second line move.

## Rabbit holes

- **The sweep is one line and seven screens.** `admin-table.tsx` decides every cell's ink
  in a single expression, so the change is in the owner rather than at call sites — but it
  lands on sessions, features, person, messages, roles, people and both stats tables at
  once. That breadth was agreed before the work started; it is recorded here so a later
  reader does not think one screen was meant.
- **`quiet` stops meaning quiet.** After this the tone selects a typography role only. If a
  genuinely faint cell is ever wanted, the answer is a new tone agreed first — not an
  override at the call site, which design-guide names as the drift this repo already has.
- **"Time to start" is a live figure in a snapshot screen.** The list fixes `openedAt` on
  open, deliberately, so "in 4 h" will go stale while the screen is up. That is consistent
  with every other figure on it and must not grow a ticker — the planner is not the intro,
  and `ChallengeCountdown` exists so that only one screen pays for a second hand.

## Tasks

- [ ] 1. `components/overlays/admin-table.tsx` — the `quiet` tone draws `text-primary`; note in the comment that the tone is now typography only
- [ ] 2. `lib/challenge-session.ts` — `STATUS_LABEL.live` becomes `LIVE`
- [ ] 3. `lib/duration.ts` — a short "until" formatter if `formatWindowLength` cannot be reused as-is, with its colocated test
- [ ] 4. `components/overlays/admin-sessions.tsx` — the session row's second line: starts, in, runs for
- [ ] 5. `pnpm i18n:extract` + Czech for anything new; `pnpm check`

## Acceptance criteria

1. Every admin table draws its string cells in the primary ink — sessions, features,
   person, messages, roles, people and both stats tables. No cell that was grey remains
   grey, and no chip changes at all.
2. A live challenge row's chip reads `LIVE`, with the dot beside it unchanged.
3. Under a challenge's name the row says when it starts, how long until it starts, and how
   long it runs — and a session four hours out reads differently from one four days out.
4. A challenge's name is still drawn in its own gradient, and every nickname on these
   screens is still drawn by `GradientName`.
5. `pnpm check` is green, Czech included.

# Winnings, told as a story — Design

Date: 2026-10-01

Follows [2026-09-23-winnings-design.md](./2026-09-23-winnings-design.md), which defined
what an award is and what it pays. This one is about what the player reads when they
open the app and find out.

## Goal

The winnings card currently says `YOU WON`, draws a trending-up icon in a violet tile,
and lists the boards as a table. It says the same thing every time, and the one fact a
player actually cares about — _I have held this board for four days now_ — is nowhere on
it, because nothing on the card knows.

Three changes:

1. **The icon goes.** It is the weakest thing on the card: a generic arrow standing in
   for a payout the figures already state.
2. **The awards become prose**, told the way the weekly recap prototype tells a week —
   sentences built from coloured segments, drawn from pools of phrasings, seeded so they
   are stable.
3. **The prose knows how long you have held the board.** A fourth day running reads as a
   fourth day running, and a board taken for the first time says so.

The fortune footer is unchanged. This is a change to one card and the data behind it; no
award is worth a point more or less than it was.

## Domain language

**run** — how many consecutive _played_ days (or weeks) on one board have been won by
this player, counting back from and including the award's own day. A day nobody
contested bridges a run rather than breaking it: a board no one played is not a board
lost. A day somebody else took ends it.

**total** — how many of that board's days this player has ever won, up to and including
the award's own day.

Both are **as of the award**, not as of today. A launch that announces Wednesday and
Thursday together shows `3` then `4`, not `4` twice.

**tenure** — run and total together; what the copy draws on to say how long a board has
been yours. Not a **reign**, which already means holding the all-time record
(`board_reigns`), and not a **medal**, which is a podium standing you can lose. A run is
neither: it is a count of closed windows, and a closed window cannot reopen.

**shape** — the named case a pool of phrasings is keyed by. The recap prototype keys week
shapes (`sweep`, `split`, `scattered`); this keys haul shapes and tenure shapes. Copy is
never keyed by a raw number, for a reason the Czech section gives.

## The card

```
              WHILE YOU WERE AWAY

   You were away. The boards were not.

   DAY · MON 29 SEP
   SPEED · HARD has not left your hands
   in eleven days.               +1,240

   DAY · SUN 28 SEP
   ACCURACY · EASY for the first time.
                                   +410

   ─────────────────────────────────────
   ADDED TO YOUR FORTUNE          +1,650
```

**The block headings stay.** The rows become sentences; the `DAY · MON 29 SEP` and
`WEEK · MON 22 SEP` labels above them do not change at all. They are the only thing on
the card that says _when_, and a ledger covering four days with no dates on it is worse
than the table it replaced. Keeping them also leaves `awardBlocks` — the grouping and
ordering in `lib/winnings-announcement.ts` — doing exactly the job it does today, so no
sentence has to carry a date token and no Czech line has to put a preposition in front
of a formatted date.

A single-block announcement, which is the common case, shows one heading above one
sentence. That reads as a caption rather than as a list, which is right.

The headline keeps its place and its styling — mono, black, 17px, 2px tracking,
`APP_VIOLET` — and loses its fixed text. The icon tile above it is deleted outright,
not replaced.

`WinningsCard` keeps the violet accent for the reason the current file already states at
length: gold means a record you hold, green means an achievement you keep, and winnings
are a fourth thing. Nothing about that changes.

### The board token

A board stays the mono label it is in the table today — `SPEED · HARD`, coloured by
`getDifficultyColor(mode, difficulty)` — set inside the prose as a `board` segment. The
recap prototype's note applies unchanged: a board is label-like, so it is set in mono
like every other label in the app.

This is also what makes Czech possible, and the Czech section returns to it.

### The payout token

`+1,240` in `APP_VIOLET`, mono, as a `pay` segment — the same figure the table's right
column shows now, moved into the sentence that explains it. The fortune total keeps the
footer to itself.

## The data

### What is missing

`my_winnings` answers _which windows did this player take_. It cannot answer _how many in
a row_, because a run depends on the days somebody **else** won, and those are exactly
the rows `my_winnings` filters out. No amount of client-side arithmetic over its result
recovers them. The number has to come from the server.

### The shared winner rule

The winnings migration is emphatic that there be one definition of who won a board. That
definition is currently a `distinct on` written out inside `my_winnings`. It gets lifted:

```sql
create or replace function board_day_winners(p_from date, p_to date)
returns table (mode text, difficulty text, day date, user_id uuid, best_score int)
language sql stable security definer set search_path = public as $$
  select distinct on (d.mode, d.difficulty, d.day)
         d.mode, d.difficulty, d.day, d.user_id, d.best_score
  from   daily_scores d
  join   profiles pr on pr.id = d.user_id and pr.nickname is not null
  where  d.day >= p_from and d.day < p_to and d.best_score > 0
  order  by d.mode, d.difficulty, d.day, d.best_score desc, d.updated_at asc;
$$;
```

Same rule, same order, same exclusions — highest score, ties to whoever reached it
first, no zeros, no nickname means no win. `my_winnings` is rebuilt on top of it with
**its signature and its columns unchanged**, so `player_profile` is untouched and pays
nothing for any of this.

### The new function

```sql
create or replace function my_winnings_detail(
  p_user_id  uuid,
  p_from_day date,
  p_today    date
) returns table (
  period     text,
  mode       text,
  difficulty text,
  won_on     date,
  best_score int,
  run        int,
  total      int
) language sql stable security definer set search_path = public as $$
  ...
$$;
```

The day half, which the week half mirrors over weeks instead of days:

```sql
with history as (
  -- Every played day on every board, from the first day the table holds. The span
  -- starts at min(day) for the reason player_profile already does: a generate_series
  -- from some fixed epoch builds thousands of empty windows to find a handful.
  select * from board_day_winners(
    coalesce((select min(d.day) from daily_scores d), p_today), p_today)
),
seqs as (
  select h.*,
         (h.user_id = p_user_id) as is_mine,
         row_number() over (partition by h.mode, h.difficulty
                            order by h.day) as seq,
         row_number() over (partition by h.mode, h.difficulty, (h.user_id = p_user_id)
                            order by h.day) as seq_mine
  from   history h
),
-- Gaps and islands. Within an unbroken block of this player's wins both counters step
-- together, so the difference is constant; a day taken by somebody else makes seq jump
-- without seq_mine, and the next block gets a new island.
tenured as (
  select s.mode, s.difficulty, s.day, s.best_score,
         count(*) over (partition by s.mode, s.difficulty, s.seq - s.seq_mine
                        order by s.day rows unbounded preceding)::int as run,
         count(*) over (partition by s.mode, s.difficulty
                        order by s.day rows unbounded preceding)::int as total
  from   seqs s
  where  s.is_mine
)
select 'day'::text, t.mode, t.difficulty, t.day, t.best_score, t.run, t.total
from   tenured t
where  t.day >= p_from_day and t.day < p_today
```

`where s.is_mine` sits before the window functions, which is what makes `total` a count
of this player's wins rather than of everyone's. The announced range is filtered last,
so a run that began in August is still counted at full length when its fourth day is the
one being announced.

### What it costs

The whole of history, for six boards, on at most one launch a day per player — the
`SEEN_WINNINGS_KEY` marker gates it, and a day with nothing won never reaches the call.
`daily_scores_board_day_idx` already orders by `(mode, difficulty, day, best_score desc,
updated_at asc)`, which is the scan this wants. `player_profile` runs the same
all-history shape on every profile open today.

### The client

`fetchMyWinnings` calls `my_winnings_detail` instead of `my_winnings` and returns
`TenuredAward[]`. `my_winnings` stays in the schema, called by `player_profile` alone.

```ts
export type TenuredAward = Award & { run: number; total: number }
```

A row whose `run` or `total` fails to parse as a positive integer falls back to
`run: 1, total: 1` rather than dropping the award. A payout the player earned must never
disappear because the story about it could not be told.

## The shapes

### Haul shape — picks the headline

Read off the announcement as a whole:

| shape       | when                                  |
| ----------- | ------------------------------------- |
| `week`      | any week award present                |
| `manyDays`  | day awards spanning two or more dates |
| `sweepDay`  | three or more boards on a single date |
| `fewBoards` | two boards on a single date           |
| `oneDay`    | one board, one date                   |

Checked in that order. A week is the rarest and the biggest, so it leads whenever one is
present.

### Tenure shape — picks each award's sentence

| shape       | when                        | reads                    |
| ----------- | --------------------------- | ------------------------ |
| `longRun`   | `run >= 11`                 | "eleven days straight"   |
| `run`       | `run` 3–10                  | "the fourth day running" |
| `milestone` | `total` ∈ {10, 25, 50, 100} | "the tenth time"         |
| `again`     | `run === 2`                 | "two days running"       |
| `first`     | `total === 1`               | "for the first time"     |
| `returning` | `run === 1`, `total > 1`    | "you took it back"       |
| `plain`     | anything left               | the board and the figure |

Checked in that order, so the better story wins: a run of twelve is told as a run even if
it happens to be the fiftieth time, and a milestone is only reached for when the run is
too short to be interesting on its own.

`plain` is unreachable given the rules above — `run === 1` with `total > 1` is
`returning`, `total === 1` is `first`, and every other run lands in a run bucket. It
exists anyway, because a shape table with no fallback is one server change away from
rendering an empty card.

### Openers

`sweepDay` and `manyDays` each get a sentence above the award lines; the other three
haul shapes get none. Those two are the cases where the awards alone do not explain
themselves — three boards on one morning, or a ledger covering days the player was not
here for, both want framing. One board on one day does not.

## The copy

### Where it lives

`constants/winnings-lines.ts`, as tuples of `msg` descriptors, following
`constants/dial-hints.ts` and `constants/news.ts`. English is the source; ids are
generated from the text.

### Headlines

```
oneDay      YOU TOOK THE DAY         DEN JE TVŮJ
            THE DAY WAS YOURS        DEN BYL TVŮJ
            ONE DAY, BANKED          DEN V KAPSE

fewBoards   TWO BOARDS, ONE DAY      DVA ŽEBŘÍČKY, JEDEN DEN
            A GOOD DAY               DOBRÝ DEN
            THE DAY WAS YOURS        DEN BYL TVŮJ

sweepDay    YOU TOOK THE FLOOR       VZAL JSI TO VŠECHNO
            NOBODY GOT NEAR          NIKDO SE NEPŘIBLÍŽIL
            A CLEAN DAY              ČISTÝ DEN

week        THE WEEK WAS YOURS       TÝDEN BYL TVŮJ
            YOU CLOSED THE WEEK      ZAVŘEL JSI TÝDEN
            A WEEK IN HAND           TÝDEN V HRSTI

manyDays    WHILE YOU WERE AWAY      ZATÍMCO JSI BYL PRYČ
            THE LEDGER, CAUGHT UP    ÚČTY DOROVNÁNY
            A FEW DAYS' WORK         PRÁCE ZA PÁR DNÍ
```

### Openers

```
sweepDay    Nobody took a board off you.
            Nikdo ti nesebral ani jeden žebříček.

            Everything you played came back yours.
            Všechno, co jsi hrál, se vrátilo tvoje.

manyDays    You were away. The boards were not.
            Byl jsi pryč. Žebříčky ne.

            A few days' worth, waiting for you.
            Pár dní práce, co na tebe čekalo.
```

### Award lines

```
first       %BOARD% for the first time. %PAY%
            %BOARD% — a poprvé. %PAY%

            Your first day on %BOARD%. %PAY%
            %BOARD% — tvůj první den na něm. %PAY%

            %BOARD% had never been yours. It is now. %PAY%
            %BOARD% nikdy tvůj nebyl. Teď je. %PAY%

again       %BOARD% two days running. %PAY%
            %BOARD% — druhý den v řadě. %PAY%

            You held %BOARD% a second day. %PAY%
            %BOARD% — udržel sis ho i druhý den. %PAY%

run         %BOARD%, the %ORD% day running. %PAY%
            %BOARD% — už %ORD% den v řadě. %PAY%

            %ORD% day in a row on %BOARD%, and nobody has taken it back. %PAY%
            %BOARD% — %ORD% den v kuse a nikdo si ho nevzal zpátky. %PAY%

longRun     %N% days straight on %BOARD%. That is not a streak any more. %PAY%
            %BOARD% — %N% dní v kuse. To už není série, to je bydliště. %PAY%

            %BOARD% has not left your hands in %N% days. %PAY%
            %BOARD% — už %N% dní ti nevypadl z ruky. %PAY%

returning   You took %BOARD% back. %PAY%
            %BOARD% sis vzal zpátky. %PAY%

            %BOARD% is yours again. %PAY%
            %BOARD% — zase tvůj. %PAY%

milestone   The %ORD% time %BOARD%'s day has been yours. %PAY%
            %BOARD% — už %ORD% den, který je tvůj. %PAY%

plain       %BOARD% — %PAY%
            %BOARD% — %PAY%
```

Week awards take the same shapes with `day` → `week` throughout, in their own pool: a
week told in the day pool would read "the fourth day running" about a window seven days
long.

### Picking

Seeded off the awards themselves, not off the clock:

```ts
const seed = awards.map((a) => `${a.period}${a.mode}${a.difficulty}${a.wonOn}`).join('|')
```

The same announcement always renders the same words. A card that reshuffled when the
player swiped back to it would read as a bug, and the recap prototype is seeded on its
week's Monday for exactly this reason.

## Czech

Two problems, both solved by keying pools on shapes instead of numbers.

### The board token never declines

`%BOARD%` renders a fixed label — `RYCHLOST · TĚŽKÁ` — which cannot take a Czech case
ending. So every Czech line is written with the token **appositive**: it leads, a dash or
comma follows, and the clause after it never governs the token.

```
✗  Na %BOARD% poprvé.              — "na" demands the locative, the label cannot give it
✓  %BOARD% — a poprvé.
✓  %BOARD% ti z ruky nevypadl už %N% dní.
```

This is a hard constraint on the Czech pools, not a style preference. It is also why the
English lines mostly lead with the board too: the two catalogs stay structurally parallel
and a new phrasing added to one has an obvious home in the other.

### Numerals

There is no `plural` macro anywhere in the app today, and this card is not the place to
introduce Czech plural agreement. Instead:

- **`run` 3–10** uses `%ORD%`, an ordinal drawn from a map of `msg` descriptors —
  `msg\`fourth\``→`msg\`čtvrtý\``. Written words, no agreement to derive. Run 2 is
`again`, which spells "two days running" out in full and needs no ordinal.
- **`run` 11+** uses the raw numeral `%N%`. Safe at every value: Czech takes the genitive
  plural from five upward, so `11 dní`, `40 dní` and `365 dní` are all simply `dní`.
- **`milestone`** has exactly four values — 10, 25, 50, 100 — so they are four more
  ordinal descriptors (`desátý`, `dvacátý pátý`, `padesátý`, `stý`), not a computation.

Eleven ordinals in all: `third` through `tenth` for runs, and `twenty-fifth`,
`fiftieth`, `hundredth` for the milestones above ten.

The gap this leaves is deliberate: no shape ever needs a Czech numeral between two and
four, which is the range that would force agreement.

### The register

Masculine second person informal, which is what the app already speaks — `VYHRÁL JSI`,
`Dohraj`, `máš`. The existing catalog settled that question; this follows it.

## The machinery

The sentence apparatus exists in `dev/weekly-recap/`, which sits outside the lingui
catalog paths on purpose. The parts that are not about weeks move out:

| from                                  | to                                       |
| ------------------------------------- | ---------------------------------------- |
| `facts.ts` → `seeded`, `pickFrom`     | `lib/sentence.ts`                        |
| `lines.ts` → `Segment`, `fill`, kinds | `lib/sentence.ts`                        |
| `recap-sentence.tsx`                  | `components/overlays/prose-sentence.tsx` |

The recap's own pools and simulation stay in `dev/` and import from the new homes. Its
rendering does not change. When the recap ships, its rails are already in production.

One thing changes in the move. `fill` splits on `{NAME}`, and lingui's ICU parser treats
braces as placeholder syntax — a `msg` containing `{BOARD}` would need escaping in every
line and every `.po` entry. The token becomes `%NAME%`:

```ts
const TOKEN = /%(\w+)%/
```

`dev/weekly-recap/lines.ts` is retokenised in the same change, so there is one syntax.

A fourth segment kind joins `plain` / `name` / `board` / `record`:

```ts
export type SegmentKind = 'plain' | 'name' | 'board' | 'record' | 'pay'
```

`pay` is mono, black, `APP_VIOLET` — the figure as the current table draws it.

## Files

| file                                                     | change                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `supabase/migrations/20261001000000_winnings_tenure.sql` | `board_day_winners`, `my_winnings` rebuilt, `my_winnings_detail` |
| `lib/sentence.ts`                                        | new — segments, `fill`, `pickFrom`, `seeded`                     |
| `components/overlays/prose-sentence.tsx`                 | new — promoted from `dev/`, plus the `pay` kind                  |
| `constants/winnings-lines.ts`                            | new — every pool, ordinals, as `msg`                             |
| `lib/winnings-story.ts`                                  | new — awards → shapes → sentences                                |
| `lib/winnings-story.test.ts`                             | new                                                              |
| `lib/winnings.ts`                                        | `TenuredAward`                                                   |
| `lib/leaderboard.ts`                                     | `fetchMyWinnings` → `my_winnings_detail`                         |
| `lib/winnings-announcement.ts`                           | `AwardBlock` carries tenured awards                              |
| `components/overlays/winnings-card.tsx`                  | icon deleted, rows → prose                                       |
| `dev/weekly-recap/{facts,lines,recap-sentence}`          | import from `lib/`, retokenised to `%NAME%`                      |
| `locales/{en,cs}/messages.po`                            | extracted and translated                                         |

## Testing

`lib/winnings-story.test.ts`, against the pure story module:

- Haul shape for each of the five cases, including the ordering — a week present beats a
  sweep, a sweep beats two boards.
- Tenure shape for each of the seven, including the priority — `run: 12, total: 50` is
  `longRun`, not `milestone`.
- Run and total are read per award, so two days of the same board announced together
  produce `3` then `4`.
- The same awards produce the same sentences on repeated calls, and two different
  announcements do not reliably produce the same one.
- Every shape has a non-empty pool, and every pool's placeholders are satisfied by the
  variables its shape supplies — a `%ORD%` in a `first` line would otherwise render as
  nothing at all.
- A malformed `run`/`total` falls back rather than dropping the award.

`lib/i18n/catalog.test.ts` already fails the build on any source message without a Czech
translation, which covers every line added here with no new test.

The SQL is exercised by hand against a seeded local database: a board won four days
running, a run broken by another player, a run bridged by a day nobody played, and a
first-ever win.

## Not doing

- **The weekly recap.** It stays in `dev/`. This moves its machinery, not its feature.
- **Tenure anywhere else.** The profile, the medals screen and the announcement bar say
  nothing new. `run` and `total` are computed for this card and read by this card.
- **A flag.** The card already exists and already ships; this changes what it says. There
  is nothing to keep anyone out of.

# Winnings, in words

Slug: winnings-prose
Stage: build
Next: /verify winnings-prose
Track: small
Branch: feat/winnings-prose
Started: 2026-10-06

## Problem

Taking a board is the only thing in the app that pays for beating other people rather than
for playing, and the card announcing it reads like a bank statement — a stack of three-column
rows the player has to decode before they find out they won anything.

## Appetite

**An evening.** A handful of fixed sentences, written once. No phrasing pools, no seed, no
composer: the same win is told in the same words every time, which is the difference between
this and the weekly recap and the reason this fits a sitting.

## Shape

A player opens the app after a day away. The launch popup's first page is their winnings, and
it no longer opens with a 64pt icon square — the title carries it, as it will on the recap
beside it.

Under **YOU WON**, a short paragraph per window instead of a table. One day's haul is one
sentence: the date, the boards that went their way, and what each was taken with. Boards are
set in mono and wear their mode's gradient at their difficulty, exactly as they do in the
recap, so a player paging between the two pages is reading one typeface and one colour rule
rather than two.

Only one figure rides along per board — the score it was taken with. The per-board payout
leaves the page: it was the column nobody could add up anyway, and the number that matters is
the one at the foot. That stays as it is — **ADDED TO YOUR FORTUNE**, the total, violet.

A week won reads as its own sentence beside the days, the way it is its own block now.

### Areas

- **The winnings card** — the icon square and the two-column rows go; sentences replace them.
  The fortune footer is untouched.
- **The sentence renderer, lifted** — `Segment`, `Sentence` and the component that draws them
  currently live under the recap's name. Both cards want them, so they move somewhere neutral
  and the recap imports them back. A move of code that has not shipped to anyone, which is the
  cheapest this will ever be.
- **The recap card** — loses its icon square too, so the deck's pages match.
- **The copy** — the new sentences as `msg` descriptors, plus Czech. Dates come from the
  recap's translated month names rather than `formatShortDay`, which prints English.
- **Nothing else.** No schema, no RPC, no mode, no rule, no capability, no feature key.

### A mode's business or the engine's?

Neither, and nothing new. The card already asks `labelOf` and `DIFFICULTIES` for a board's
name and `getDifficultyColor` for its colour. It branches on no mode and will not start.

### Does it need a flag?

No — and that is the thing to hold on to. Unlike the recap, which sits at floor `nobody`, the
winnings card ships to **every player on the next deploy**. There is no soft landing here: a
clumsy sentence or a missing Czech string is in front of everyone at once.

## In

- The icon square out of the winnings card, and out of the recap card.
- The table replaced by one sentence per block: date, boards, and the score each was taken with.
- The fortune total kept exactly as it is.
- `Segment`/`Sentence` and the sentence component moved to shared ground; the recap repointed.
- The new sentences in English and Czech, with dates in the player's language.

## Out

- **Phrasing pools.** One fixed sentence per shape. Variety is what the recap is for, and it
  is what turns an evening into two days.
- **Relative dates.** No "yesterday", no "last Monday". The card can show a window from a week
  ago and a relative word would be a lie on exactly the launch that matters most.
- **The per-board payout.** Deliberately dropped, not forgotten. If it turns out players miss
  it, it comes back as a figure in the sentence, not as a column.
- **Fixing `formatShortDay`.** Its English months are also shown by `profile-reign-row.tsx`
  and `medals-overlay.tsx`. That is a real bug and a separate item — this one stops at not
  adding a fourth call site.
- **The fortune footer.** Not restyled, not reworded, not moved.
- **Touching what winnings are worth.** `lib/winnings.ts` is arithmetic and stays shut.

## Rabbit holes

1. **A sentence with a list in it.** One board is easy; three boards on one day is "X with
   12,400, Y with 8,100 and Z with 900", and that comma-and-conjunction join has to be built
   out of translated fragments rather than `Array.join`. Czech punctuates and conjoins
   differently. **The way around:** cap what one sentence lists and let a long day run to a
   second sentence, rather than growing a list-formatter. Decide the cap in `build`.

2. **It reverses a stated decision.** `lib/winnings-announcement.ts` calls this card "a ledger,
   not a narrative", and sorts its blocks on that reasoning — newest first, biggest first
   inside. The sort still makes sense for prose, but the comment will be wrong the moment this
   lands and should be rewritten rather than left to contradict the screen.

3. **Lifting the renderer touches the recap.** The recap is built and unverified. Moving its
   types and its component means its tests and the gallery move with them, and a careless move
   is how an unverified feature acquires a second reason to fail. **The way around:** the move
   is its own task, done first and on its own, with the recap's suite green before anything is
   written for winnings.

4. **No flag, every player.** See above. The mitigation is not technical: the Czech gets read
   on screen rather than assumed, and `verify` drives the card with one board, several boards,
   and a day and a week together before this is called done.

## Tasks

- [x] 1. Lift `Segment`/`SegmentKind`/`Sentence` and the sentence component out of the recap's
      files into shared ground; repoint the recap, its test and the gallery; recap suite green
- [x] 2. Drop the icon square from both the recap card and the winnings card
- [x] 3. Winnings sentences: a block becomes a sentence of date, boards and scores; the table
      and the per-board payout go; the fortune footer stays
- [x] 4. `pnpm i18n:extract`, then Czech, with dates on the recap's translated month names
- [x] 5. Rewrite the "ledger, not a narrative" comment in `lib/winnings-announcement.ts`
- [x] 6. `pnpm check`

## Acceptance criteria

1. Neither the winnings card nor the recap card draws an icon square; both open on their title.
2. A day on which one board was won reads as one sentence naming the date, the board and the
   score it was taken with — no table rows, no per-board payout.
3. A day on which several boards were won names each of them with its score, in the order the
   blocks already sort in, without an untranslatable `Array.join` list.
4. A week won reads as its own sentence, distinguishable from a day.
5. Board names are mono and wear their mode's gradient at their difficulty, as in the recap.
6. **ADDED TO YOUR FORTUNE** and its total are unchanged in wording, placement and colour.
7. In Czech, every sentence reads correctly and the date is Czech — no `OCT` on screen.
8. `pnpm check` is green, `pnpm i18n:verify` included.

## Build notes

**The shared module took more than the shape named.** `Segment`/`Sentence` and the renderer
were the stated move; `fill`, `Translate` and `MONTHS` went with them, because the winnings
templates need all three and leaving them under the recap's name would have made the new card
import from `lib/recap-lines.ts`. `lib/prose.ts` is now "the shared vocabulary of a drawn
sentence" — segments, the `[A]` template mechanism, and the month names a date is written
with. The component is `ProseSentence` in `components/overlays/prose-sentence.tsx`.

**The list is joined by two templates, not by a cap.** The shape's rabbit hole suggested
capping what one sentence lists and running long days to a second sentence. That turned out
unnecessary: `, [B] with [S]` and ` and [B] with [S]` are two ordinary Lingui messages, so the
comma and the conjunction are the translator's and nothing is `Array.join`ed. Criterion 3 asked
for a translatable join and this is one. Five boards in a day reads fine; the cap would have
cost a sentence boundary for nothing.

**The Czech dodges the player's gender.** "you took" is `vzal` or `vzala` in Czech depending on
who is reading, and the app does not know. Every Czech phrasing is built on
`[DATE] byla tvoje [B]` instead — the verb agrees with the _board_, and both scored modes are
feminine in Czech. That is the same assumption the recap's `[MODE] patřila` already makes, and
it breaks only if a scored mode is ever added whose Czech name is not feminine.

**The full stop is appended, not written into the templates.** It would otherwise have to
appear in two of the four and be absent from the other two, and a translator holding one
fragment cannot tell which kind they have.

**`awardPoints` is now called only by its own test.** Left in `lib/winnings.ts` deliberately:
the shape says the per-board payout is "dropped, not forgotten", and knip counts tests as
entry points so it does not flag. Deleting it would be the thing to undo if the figure comes
back.

**Known and not fixed: number grouping follows the device, not the app.** `toLocaleString()`
renders `31,219` rather than `31 219` for a Czech player whose phone is in English. This is
pre-existing and app-wide — the old table did it, the fortune total still does, and so does
every other figure in the app — so fixing it here would have been one screen out of step.
Worth its own item.

**Also noted, not fixed:** `lib/format-date.ts` hardcodes English month names, so
`formatShortDay` prints `5 OCT` to Czech players in `profile-reign-row.tsx` and
`medals-overlay.tsx`. The new prose uses the translated `MONTHS` instead, which is why no
fourth call site was added. The existing two are a separate bug.

**The working tree is shared, again.** A third body of work — a "compare" feature, plus
`hooks/use-bar-color.ts` and a `use-theme.tsx` change — was in flight during this build and
briefly broke `tsc` tree-wide. None of it was touched here.

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { pickFrom, type Rng } from '@/lib/rng'

// The phrasings a recap is told in, and the only part of this feature a person is meant to
// edit.
//
// A sentence is built from segments rather than from a string, because three things in a
// recap are coloured and the rest is not: a nickname, a board, and a takeover. React Native
// has no innerHTML to lean on, so the composer hands the card a structure and the card
// decides what each kind looks like.
//
// **Tokens are `[A]`, not `{A}`.** Every phrasing below is a Lingui message, and `{A}` is
// ICU's own placeholder syntax — a message carrying one is at the mercy of whichever
// formatter resolves it. Square brackets mean nothing to ICU, so the template survives
// translation intact and `fill` is the only thing that ever reads it.

// What a resolved descriptor looks like to this file — `t` from `useLingui`, or an English
// resolver in a test. Passed in rather than imported so that composing a recap stays a pure
// function of the week, the seed and the locale.
export type Translate = (descriptor: MessageDescriptor) => string

export type SegmentKind = 'plain' | 'name' | 'board' | 'takeover'

// `color` is carried rather than looked up by the card: a board's colour is its mode's
// gradient at its difficulty, which the composer knows and a sentence renderer would have
// to be handed the board to work out. A takeover's gold is the other way round — it depends
// on the theme, so the card resolves that one itself.
export type Segment = { text: string; kind: SegmentKind; color?: string }
export type Sentence = readonly Segment[]

const plain = (text: string): Segment => ({ text, kind: 'plain' })

// Left uncoloured here. Colour is handed out per recap once every name is known — see
// `colourNames` — because what a reader needs is to tell the two or three names in front of
// them apart, which a per-player colour cannot promise.
export const name = (text: string): Segment => ({ text, kind: 'name' })

// Splitting on a capturing group interleaves literals and keys: even indices are text, odd
// are placeholder names. Cheaper to read than a matchAll loop, and it cannot run off the end
// of the template.
const TOKEN = /\[(\w+)\]/

function fill(
  template: string,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence {
  return template.split(TOKEN).flatMap((part, index) => {
    if (part === '') return []
    if (index % 2 === 0) return [plain(part)]
    const value = vars[part]
    if (value === undefined) return []
    return [typeof value === 'string' ? plain(value) : value]
  })
}

// ─── What a translator has to hold ──────────────────────────────────────────────────────
//
// Two rules the Czech is written under, and neither can be read off the English:
//
// 1. **No variant may inflect a nickname.** Czech cannot form a possessive of `Mull3rm1x_`.
//    Seven English variants do (`[A]’s`); the Czech ones carry the case on a noun beside the
//    name — `patřil hráči [A]` — rather than on the name itself.
// 2. **A variant must read correctly for every value its placeholders can take.** These are
//    not ICU messages, so there is no `plural` to lean on; a Czech variant restructures
//    instead (`[P] z 7 dnů`, never `[P] dny`). The ranges:
//
//    | Token      | Range  | What it counts                                           |
//    | ---------- | ------ | -------------------------------------------------------- |
//    | `N` `M` `P`| 1–7    | Days.                                                    |
//    | `C`        | 3–7    | Players, in `scattered`; 4–7 in `contested`.             |
//    | `C`        | 2–6    | Takeovers, in `many` — there are only six boards to take.|

// Which opener a week gets. Not quite the week shapes: `sweepBut` needs two pools, because
// "every day but Thursday" and "every day but Thursday and Saturday" are different
// sentences and one template cannot be both.
export type HeadlineKey =
  | 'empty'
  | 'quiet'
  | 'quietSweep'
  | 'sweep'
  | 'sweepBut1'
  | 'sweepBut2'
  | 'split'
  | 'scattered'

type Pool = readonly [MessageDescriptor, ...MessageDescriptor[]]

// Every variant states only what its shape actually guarantees. An earlier `scattered`
// opener read "nobody could hold it two days running", which nothing verifies and which is
// false the moment a scattered week has someone repeating — the rule this pool is written
// under is that a phrasing may not claim more than its shape proves.
const HEADLINES = {
  empty: [
    msg`Nobody played last week. The boards are exactly where you left them.`,
    msg`A week with nothing in it. Not one board was taken.`,
  ],
  quiet: [
    msg`A quiet week. Only [P] days saw a board taken at all, and [A] took [N] of them.`,
    msg`Barely a week — [P] days played. [A] had [N] of those to themselves.`,
    msg`Not much happened. [A] took [N] of the [P] days anyone turned up for.`,
  ],
  // A quiet week one player took outright. The pool above would render it as "took 3 of
  // the 3 days", which is true and reads like a counting error.
  quietSweep: [
    msg`A quiet week, and [A] had all [P] days of it to themselves.`,
    msg`Only [P] days were played at all, and [A] took every one.`,
    msg`Barely a week — [P] days, and all of them [A]’s.`,
  ],
  sweep: [
    msg`[A] took every day of it, and never once looked like giving one back.`,
    msg`Seven days, one name. [A] had the week from Monday and never let go.`,
    msg`The week was [A]’s outright — every day of it, and not one of them close.`,
    msg`[A] won Monday, then won everything that came after it.`,
  ],
  sweepBut1: [
    msg`[A] took every day but [D], when [B] turned up and took that one instead.`,
    msg`The week belonged to [A], [D] excepted — [B] saw to that.`,
    msg`Every day was [A]’s except [D]. [B] got exactly one, and made it count.`,
    msg`[A] lost a single day all week. [B] took [D], and nothing else.`,
  ],
  sweepBut2: [
    msg`[A] took the week bar [D] and [E], which got away.`,
    msg`[A] held the rest of it. The other two days — [D] and [E] — went elsewhere.`,
    msg`Two days escaped [A] all week: [D], and then [E].`,
  ],
  split: [
    msg`[A] and [B] split the week, [N] days to [M], and nobody else got near it.`,
    msg`Two names all week: [A] took [N] days, [B] the other [M].`,
    msg`[A] edged it [N]–[M]. [B] was never more than a day behind.`,
    msg`A week of two. [A] [N], [B] [M], and not much between them.`,
  ],
  scattered: [
    msg`Nobody got a grip on it — [C] different players took a day of it.`,
    msg`The week went everywhere. [A] took the most of it with [N] days, which was not many.`,
    msg`[C] names across [P] days, and no pattern to speak of. [A] came closest with [N].`,
    msg`Nobody owned this one. [A] led on [N] days, and [N] was enough to lead.`,
  ],
} as const satisfies Record<HeadlineKey, Pool>

// `counterpoint` is `owned` told against a week that already has a leader: "X took every
// day" followed by "Y owned Speed Extreme" reads as a contradiction even though both are
// true, because the headline counts days and the board line counts boards. Naming the board
// as the exception is what reconciles them.
export type BoardStoryKind = 'owned' | 'ownedBut' | 'contested' | 'counterpoint'

const BOARD_LINES = {
  owned: [
    msg`[W] owned [MODE] — every day of it, on every difficulty that got played.`,
    msg`[BOARD] never left [W]’s hands.`,
    msg`Nobody could take [BOARD] off [W] once.`,
  ],
  ownedBut: [
    msg`[W] owned [BOARD] — every day but [D], when [O] appeared from nowhere and took it.`,
    msg`[BOARD] was [W]’s all week, [D] aside. [O] had that one.`,
    msg`[W] held [BOARD] until [D], when [O] got in the way of it.`,
  ],
  contested: [
    msg`[BOARD] was the week’s real argument — [C] different names on it.`,
    msg`[BOARD] changed hands more than it usually does: [C] players took a day of it.`,
  ],
  counterpoint: [
    msg`One board did not go along with it: [BOARD] stayed [W]’s throughout.`,
    msg`Not everywhere, though. [W] held [BOARD] every day of the week.`,
    msg`[BOARD] was the exception — [W] had that one from start to finish.`,
  ],
} as const satisfies Record<BoardStoryKind, Pool>

// The closing sentence. A **takeover** is an all-time board changing hands inside the
// window — the copy calls it a record, which is what a player calls it, and the code does
// not, because a record in this app is a score crossing a bar mid-run and then gone.
export type TakeoverKey = 'none' | 'one' | 'many'

const TAKEOVER_LINES = {
  none: [
    msg`Nothing all-time moved. Every record standing on Monday was still standing on Sunday.`,
    msg`No records fell. They rarely do.`,
    msg`The all-time boards were left exactly as they were found.`,
  ],
  one: [
    msg`One all-time record fell: [BOARD], on [D]. It is [W]’s now.`,
    msg`[W] took the all-time [BOARD] record on [D], and still has it.`,
    msg`One record went down — [BOARD], [D], to [W].`,
  ],
  many: [
    msg`[C] all-time records went down, which is more than most months manage.`,
    msg`A bad week for the record boards: [C] of them fell.`,
    msg`[C] all-time records changed hands. That does not usually happen in one week.`,
  ],
} as const satisfies Record<TakeoverKey, Pool>

const line = (
  rng: Rng,
  t: Translate,
  pool: Pool,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => fill(t(pickFrom(rng, pool)), vars)

export const headline = (
  rng: Rng,
  t: Translate,
  key: HeadlineKey,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => line(rng, t, HEADLINES[key], vars)

export const boardLine = (
  rng: Rng,
  t: Translate,
  key: BoardStoryKind,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => line(rng, t, BOARD_LINES[key], vars)

export const takeoverLine = (
  rng: Rng,
  t: Translate,
  key: TakeoverKey,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => line(rng, t, TAKEOVER_LINES[key], vars)

// ─── Names of things ────────────────────────────────────────────────────────────────────

// Monday first, so the index into this is the index into a week — the same zero the cells
// are laid out from.
export const WEEKDAYS = [
  msg`Monday`,
  msg`Tuesday`,
  msg`Wednesday`,
  msg`Thursday`,
  msg`Friday`,
  msg`Saturday`,
  msg`Sunday`,
] as const

// January first, so the index into this is `Date.getUTCMonth()`.
//
// Written in capitals because that is the register the window label is set in, and because
// nothing down the line upper-cases the result: Czech declines the month after a day number
// — "22. – 28. září" — and shouting it would be the wrong word before it was the wrong case.
// Used by `periodLabel` and nothing else, which is what makes a shouting form safe here.
export const MONTHS = [
  msg`JANUARY`,
  msg`FEBRUARY`,
  msg`MARCH`,
  msg`APRIL`,
  msg`MAY`,
  msg`JUNE`,
  msg`JULY`,
  msg`AUGUST`,
  msg`SEPTEMBER`,
  msg`OCTOBER`,
  msg`NOVEMBER`,
  msg`DECEMBER`,
] as const

// Every phrasing, flat. Exported for one thing only: the catalog test, which checks that a
// Czech variant carries the same tokens its English source does. A translation that drops a
// token loses the sentence's subject and says so to nobody.
export const ALL_PHRASINGS: readonly MessageDescriptor[] = [
  ...Object.values(HEADLINES).flat(),
  ...Object.values(BOARD_LINES).flat(),
  ...Object.values(TAKEOVER_LINES).flat(),
]

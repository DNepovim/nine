import { pickFrom, type Random } from '@/dev/weekly-recap/facts'

// The phrasings, and the only part of this prototype a person is meant to edit.
//
// A sentence is built from segments rather than from a string, because three things in
// a recap are coloured and the rest is not: a nickname, a board, and a record. React
// Native has no innerHTML to lean on, so the composer hands the card a structure and the
// card decides what each kind looks like.

export type SegmentKind = 'plain' | 'name' | 'board' | 'record'

// `color` is carried rather than looked up by the card: a board's colour is its mode's
// gradient at its difficulty, which the composer knows and a sentence renderer would
// have to be handed the board to work out. A record's gold is the other way round — it
// depends on the theme, so the card resolves that one itself.
export type Segment = { text: string; kind: SegmentKind; color?: string }
export type Sentence = readonly Segment[]

const plain = (text: string): Segment => ({ text, kind: 'plain' })
// Left uncoloured here. Colour is handed out per recap once every name is known — see
// `colourNames` — because what a reader needs is to tell the two or three names in front
// of them apart, which a per-player colour cannot promise.
export const name = (text: string): Segment => ({ text, kind: 'name' })

// Splitting on a capturing group interleaves literals and keys: even indices are text,
// odd are placeholder names. Cheaper to read than a matchAll loop, and it cannot run off
// the end of the template.
const TOKEN = /\{(\w+)\}/

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

// Which opener a week gets. Not quite the week shapes: `sweepBut` needs two pools,
// because "every day but Thursday" and "every day but Thursday and Saturday" are
// different sentences and one template cannot be both.
export type HeadlineKey =
  | 'empty'
  | 'quiet'
  | 'quietSweep'
  | 'sweep'
  | 'sweepBut1'
  | 'sweepBut2'
  | 'split'
  | 'scattered'

type Pool = readonly [string, ...string[]]

// Every variant states only what its shape actually guarantees. An earlier `scattered`
// opener read "nobody could hold it two days running", which nothing verifies and which
// is false the moment a scattered week has someone repeating — the rule this pool is
// written under is that a phrasing may not claim more than its shape proves.
const HEADLINES = {
  empty: [
    'Nobody played last week. The boards are exactly where you left them.',
    'A week with nothing in it. Not one board was taken.',
  ],
  quiet: [
    'A quiet week. Only {P} days saw a board taken at all, and {A} took {N} of them.',
    'Barely a week — {P} days played. {A} had {N} of those to themselves.',
    'Not much happened. {A} took {N} of the {P} days anyone turned up for.',
  ],
  // A quiet week one player took outright. The pool above would render it as "took 3 of
  // the 3 days", which is true and reads like a counting error.
  quietSweep: [
    'A quiet week, and {A} had all {P} days of it to themselves.',
    'Only {P} days were played at all, and {A} took every one.',
    'Barely a week — {P} days, and all of them {A}’s.',
  ],
  sweep: [
    '{A} took every day of it, and never once looked like giving one back.',
    'Seven days, one name. {A} had the week from Monday and never let go.',
    'The week was {A}’s outright — every day of it, and not one of them close.',
    '{A} won Monday, then won everything that came after it.',
  ],
  sweepBut1: [
    '{A} took every day but {D}, when {B} turned up and took that one instead.',
    'The week belonged to {A}, {D} excepted — {B} saw to that.',
    'Every day was {A}’s except {D}. {B} got exactly one, and made it count.',
    '{A} lost a single day all week. {B} took {D}, and nothing else.',
  ],
  sweepBut2: [
    '{A} took the week bar {D} and {E}, which got away.',
    '{A} held the rest of it. The other two days — {D} and {E} — went elsewhere.',
    'Two days escaped {A} all week: {D}, and then {E}.',
  ],
  split: [
    '{A} and {B} split the week, {N} days to {M}, and nobody else got near it.',
    'Two names all week: {A} took {N} days, {B} the other {M}.',
    '{A} edged it {N}–{M}. {B} was never more than a day behind.',
    'A week of two. {A} {N}, {B} {M}, and not much between them.',
  ],
  scattered: [
    'Nobody got a grip on it — {C} different players took a day of it.',
    'The week went everywhere. {A} took the most of it with {N} days, which was not many.',
    '{C} names across {P} days, and no pattern to speak of. {A} came closest with {N}.',
    'Nobody owned this one. {A} led on {N} days, and {N} was enough to lead.',
  ],
} as const satisfies Record<HeadlineKey, Pool>

// `counterpoint` is `owned` told against a week that already has a leader: "X took every
// day" followed by "Y owned Speed Extreme" reads as a contradiction even though both are
// true, because the headline counts days and the board line counts boards. Naming the
// board as the exception is what reconciles them.
export type BoardStoryKind = 'owned' | 'ownedBut' | 'contested' | 'counterpoint'

const BOARD_LINES = {
  owned: [
    '{W} owned {MODE} — every day of it, on every difficulty that got played.',
    '{BOARD} never left {W}’s hands.',
    'Nobody could take {BOARD} off {W} once.',
  ],
  ownedBut: [
    '{W} owned {BOARD} — every day but {D}, when {O} appeared from nowhere and took it.',
    '{BOARD} was {W}’s all week, {D} aside. {O} had that one.',
    '{W} held {BOARD} until {D}, when {O} got in the way of it.',
  ],
  contested: [
    '{BOARD} was the week’s real argument — {C} different names on it.',
    '{BOARD} changed hands more than it usually does: {C} players took a day of it.',
  ],
  counterpoint: [
    'One board did not go along with it: {BOARD} stayed {W}’s throughout.',
    'Not everywhere, though. {W} held {BOARD} every day of the week.',
    '{BOARD} was the exception — {W} had that one from start to finish.',
  ],
} as const satisfies Record<BoardStoryKind, Pool>

export type RecordKey = 'none' | 'one' | 'many'

const RECORD_LINES = {
  none: [
    'Nothing all-time moved. Every record standing on Monday was still standing on Sunday.',
    'No records fell. They rarely do.',
    'The all-time boards were left exactly as they were found.',
  ],
  one: [
    'One all-time record fell: {BOARD}, on {D}. It is {W}’s now.',
    '{W} took the all-time {BOARD} record on {D}, and still has it.',
    'One record went down — {BOARD}, {D}, to {W}.',
  ],
  many: [
    '{C} all-time records went down, which is more than most months manage.',
    'A bad week for the record boards: {C} of them fell.',
    '{C} all-time records changed hands. That does not usually happen in one week.',
  ],
} as const satisfies Record<RecordKey, Pool>

export const headline = (
  random: Random,
  key: HeadlineKey,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => fill(pickFrom(random, HEADLINES[key]), vars)

export const boardLine = (
  random: Random,
  key: BoardStoryKind,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => fill(pickFrom(random, BOARD_LINES[key]), vars)

export const recordLine = (
  random: Random,
  key: RecordKey,
  vars: Readonly<Record<string, Segment | string>>,
): Sentence => fill(pickFrom(random, RECORD_LINES[key]), vars)

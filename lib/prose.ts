import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

// The shared vocabulary of a sentence the app draws rather than prints.
//
// Two cards in the launch popup speak in prose — the weekly recap, and what the player won
// while they were away — and in both of them some words are coloured and the rest are not.
// React Native has no innerHTML to lean on, so whatever composes a sentence hands over a
// structure and the component that draws it decides what each kind of word looks like.
//
// Shared ground rather than either card's own file: a board set in one typeface on one page
// and another typeface on the next is two designs, and the player pages between them.

// What a word in a sentence is for. Typography follows from this, and so does colour where
// the kind has one of its own.
//
// - `plain` — the prose around everything else.
// - `name` — a nickname. Coloured per paragraph so two people never share a colour.
// - `board` — a mode × difficulty, in its mode's gradient read at its difficulty.
// - `takeover` — an all-time board that changed hands, in gold.
// - `score` — what a board was taken with. Mono like a board and deliberately uncoloured:
//   on the winnings card violet already means *what you were paid*, and a second violet
//   figure in the same sentence would blur which number is which.
export type SegmentKind = 'plain' | 'name' | 'board' | 'takeover' | 'score'

// `color` is carried rather than looked up by the card: a board's colour is its mode's
// gradient at its difficulty, which the composer knows and a sentence renderer would have to
// be handed the board to work out. Gold is the other way round — it depends on the theme, so
// the component resolves that one itself.
export type Segment = { text: string; kind: SegmentKind; color?: string }

export type Sentence = readonly Segment[]

export const plain = (text: string): Segment => ({ text, kind: 'plain' })

// What a resolved descriptor looks like to a composer — `t` from `useLingui`, or an English
// resolver in a test. Passed in rather than imported so that composing prose stays a pure
// function of its facts and the locale.
export type Translate = (descriptor: MessageDescriptor) => string

// ─── Templates ──────────────────────────────────────────────────────────────────────────
//
// **Tokens are `[A]`, not `{A}`.** Every phrasing in this app is a Lingui message, and
// `{A}` is ICU's own placeholder syntax — a message carrying one is at the mercy of
// whichever formatter resolves it. Square brackets mean nothing to ICU, so the template
// survives translation intact and `fill` is the only thing that ever reads it.
//
// Filling a template rather than gluing fragments is what keeps a sentence translatable:
// one template is one word order, and a translator may rearrange everything inside it.

// Splitting on a capturing group interleaves literals and keys: even indices are text, odd
// are placeholder names. Cheaper to read than a matchAll loop, and it cannot run off the end
// of the template.
const TOKEN = /\[(\w+)\]/

export function fill(
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

// ─── Dates inside a sentence ────────────────────────────────────────────────────────────

// January first, so the index into this is `Date.getUTCMonth()`.
//
// Written in capitals because that is the register these cards set their dates in, and
// because nothing down the line upper-cases the result: Czech declines the month after a day
// number — "22. září" — and shouting it would be the wrong word before it was the wrong case.
//
// Not `formatShortDay` in lib/format-date.ts, which has its month names hardcoded in English
// and prints "5 OCT" to a Czech player. That is a real bug in the three screens that still
// call it, and a separate piece of work; this is why no fourth screen was added to them.
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

// The same twelve clipped, for a sentence that names a date rather than being titled with
// one. Indexed the same way.
//
// Sentence case, not capitals: these sit inside prose — "On 5 Oct you took" — where a
// shouted month would read as a heading that had fallen into the paragraph. The long names
// above keep their capitals because the only thing that uses them is a title.
//
// Czech is given the number instead of a clipped name. An abbreviated Czech month takes a
// terminal full stop ("5. říj.") which collides with the dot the day already carries, and
// the numeric form is what a Czech reader is shown a short date in anyway.
const SHORT_MONTHS = [
  msg`Jan`,
  msg`Feb`,
  msg`Mar`,
  msg`Apr`,
  msg`May`,
  msg`Jun`,
  msg`Jul`,
  msg`Aug`,
  msg`Sep`,
  msg`Oct`,
  msg`Nov`,
  msg`Dec`,
] as const

// One day, as it is named inside a sentence: "5 Oct", and in Czech "5. 10.". The dot after
// the day belongs to the template rather than to the number, because it is Czech ordinal
// punctuation and not part of the day.
//
// Short rather than spelled out because of where it is read: the winnings card is a stack of
// four or five sentences that differ only in a date, a board and a figure, and a month
// spelled out in full was the longest word in every one of them.
export function dayLabel(iso: string, t: Translate): string {
  const at = new Date(`${iso}T00:00:00Z`)
  const day = String(at.getUTCDate())
  const month = t(SHORT_MONTHS[at.getUTCMonth()] ?? SHORT_MONTHS[0])
  return t(msg`${day} ${month}`)
}

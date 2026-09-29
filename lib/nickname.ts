// The player's nickname — the name that goes on the board, into an announcement, and on
// top of their profile.
//
// The rule lives here rather than in the modal because the database enforces the same
// shape as a check constraint, and a rule written twice in two languages is a rule that
// will eventually disagree with itself. Same trade `lib/motto.ts` makes.

// How short and how long a nickname may be, counted in characters rather than UTF-16
// code units — the regex below is built from these and, under `u`, its quantifier counts
// code points, the same unit Postgres's `char_length` counts in.
export const NICK_MIN = 3
export const NICK_MAX = 16

// Letters, digits and the underscore, in any script: `Ján` and `Ñoño` are names someone
// is actually called, and a board that cannot spell them is a board that renames people.
// Everything else is out — which is what keeps an emoji out, since a picture is neither
// a letter nor a digit.
const SHAPE = new RegExp(`^[\\p{L}\\p{N}_]{${NICK_MIN},${NICK_MAX}}$`, 'u')

// What we call an emoji when the modal explains itself: the pictograph planes, the symbol
// and dingbat blocks a phone keyboard draws in colour, and the variation selector that
// turns a plain glyph into one of them.
//
// Code point ranges rather than `\p{Extended_Pictographic}` because the database check
// mirrors this list character for character, and Postgres has no such property escape to
// mirror it with.
const EMOJI_RANGES: readonly (readonly [number, number])[] = [
  [0x2190, 0x27bf], // arrows, misc symbols, dingbats — ✌ ☃ ✈
  [0x2b00, 0x2bff], // more arrows and stars — ⭐ ⬆
  [0xfe0f, 0xfe0f], // variation selector-16, the "draw the one before me in colour" mark
  [0x1f000, 0x1faff], // the pictograph planes — 😀 🔥 🇨🇿 🅰
]

// `Array.from` rather than a regex over the whole string: it walks code points, so a
// character outside the basic plane is tested whole instead of as its two halves.
const hasEmoji = (value: string): boolean =>
  Array.from(value).some((char) => {
    const codePoint = char.codePointAt(0) ?? 0
    return EMOJI_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high)
  })

// Why a nickname was turned down, or null if it was not. Two answers rather than one
// because the general rule does not read as an answer to someone who typed a rocket:
// 'letters, numbers and underscore' names what is allowed without ever saying the thing
// they did, so they try the same name again with a different picture in it.
export type NicknameProblem = 'emoji' | 'shape'

export const nicknameProblem = (raw: string): NicknameProblem | null => {
  const trimmed = raw.trim()
  if (SHAPE.test(trimmed)) return null
  return hasEmoji(trimmed) ? 'emoji' : 'shape'
}

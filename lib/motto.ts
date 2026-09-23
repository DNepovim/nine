// The player's motto — one line they write about themselves, under their nickname on
// their profile. Public, like every other figure on that modal, but the only one they
// author rather than earn.
//
// The rules live here rather than in the modal because the database enforces the same
// ceiling as a check constraint, and a limit written twice in two languages is a limit
// that will eventually disagree with itself.

// How long a motto may be. Counted in characters, not code units — see `mottoLength`.
export const MOTTO_MAX = 50

// The two invisible characters a motto keeps: the zero-width non-joiner (U+200C), which
// is ordinary spelling in Persian, and the zero-width joiner (U+200D), which is what
// holds a multi-person emoji together. Both are formatting characters and would
// otherwise be dropped by the rule below — dropping them would quietly rewrite what the
// player typed rather than clean it up.
const JOINERS = [0x200c, 0x200d]

// A character that would not draw as itself: the C0/C1 controls and the formatting
// characters — invisible spaces, bidi overrides that can reorder the line around them.
//
// Whitespace is spared here and handled by the collapse below instead, because a newline
// is a control character the player meant something by: it should become a space rather
// than weld the words either side of it together.
const isUnprintable = (char: string): boolean =>
  /[\p{Cc}\p{Cf}]/u.test(char) &&
  !/\s/u.test(char) &&
  !JOINERS.includes(char.codePointAt(0) ?? 0)

// What a motto is stored as. Unprintables dropped outright, every remaining run of
// whitespace flattened to a single space, and the ends trimmed — so a motto is always
// one line, however many the keyboard offered.
//
// `Array.from` rather than a regex over the whole string: it walks code points, so a
// character outside the basic plane is tested whole instead of as its two halves.
export const normalizeMotto = (raw: string): string =>
  Array.from(raw)
    .filter((char) => !isUnprintable(char))
    .join('')
    .replace(/\s+/gu, ' ')
    .trim()

// How long a motto reads as, in characters rather than UTF-16 code units — `Array.from`
// walks code points, so an emoji counts once here exactly as Postgres's `char_length`
// counts it. `.length` would call it two, and the counter under the input would then
// disagree with the constraint it is there to keep the player inside.
export const mottoLength = (value: string): number => Array.from(value).length

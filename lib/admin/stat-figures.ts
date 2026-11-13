// How the ANALYTICS screen writes a figure against the window before it, and reads the
// rung a receipt was played on.

import type { Difficulty } from '@/modes'

// The arrow that says which way a figure moved against the window before it. A glyph and
// not a colour: the direction has to be legible on its own — and *fewer runs than last
// week* is information rather than an alarm, which is what a red figure would make it.
export const arrow = (now: number, before: number): string =>
  now === before ? '·' : now > before ? '▲' : '▼'

// The whole of a tile's second line: which way it moved, and what it moved from. Takes
// the word already translated, because a pure helper has no access to the catalog.
export const against = (now: number, before: number, was: string): string =>
  `${arrow(now, before)} ${was} ${String(before)}`

// The rung a receipt was played on, narrowed. `run_receipts.difficulty` is a column with
// a check constraint on it rather than an enum this build owns, and the group-by coalesces
// a null to 'unknown' — so the one honest thing to do with a value none of the three names
// is to print it and colour it dim.
export const rungOf = (value: string): Difficulty | null =>
  value === 'easy' || value === 'hard' || value === 'extreme' ? value : null

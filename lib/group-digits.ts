// A figure with its thousands marked off: 1 240, 86 500, 4 912 006.
//
// The comparison table sets seven-figure fortunes and five-figure hit counts in an 11px
// column, where an unbroken run of digits is a number the reader has to count rather than
// read. Marking the groups is the whole fix — nothing else about the figure changes.

// A no-break space rather than the comma `toLocaleString` would reach for.
//
// Two reasons. This app is read in English and in Czech, where a comma is the decimal
// point — a column that meant one thing on one phone and something else on another is
// worse than a column that means the same thing on both, and the space is correct Czech
// and acceptable English. And no-break rather than plain, so a long figure can never be
// broken across two lines at a separator that is meant to hold it together.
const GROUP = ' '

// How many digits a group holds.
const GROUP_SIZE = 3

// Below a thousand there is nothing to mark off, which the grouping arrives at on its own —
// stated here only because it is the question a reader of this file has.
//
// Cut from the right rather than matched by a pattern. The usual one-line regular
// expression for this is a lookahead over a repeated group, which backtracks on a long
// run of digits; slicing is the same answer and reads as what it does.
export function groupDigits(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  const digits = String(Math.abs(rounded))
  // Where the first group starts: a length that is not a whole number of groups leaves a
  // short one at the front, which is the only group that is ever under three digits.
  const head = digits.length % GROUP_SIZE || GROUP_SIZE
  const groups = [digits.slice(0, head)]
  for (let at = head; at < digits.length; at += GROUP_SIZE) {
    groups.push(digits.slice(at, at + GROUP_SIZE))
  }
  return sign + groups.join(GROUP)
}

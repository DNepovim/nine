// A run's length, for the TIME cell on the pause and game over screens — 12″ under a
// minute, 1′12″ over one. The unit marks rather than a colon: a colon is what a clock
// uses, and the cell sits in a row of figures beside HITS and two percentages, where
// "12:04" read as a time of day rather than as a length. Prime and double prime are how a
// duration is written wherever one is timed.
//
// A run shorter than a minute says only its seconds. "0′12″" spends its first two
// characters saying there is nothing to say, in a cell whose whole job is to be read at a
// glance — and every first run, every run that ended on the opening target, is one of
// these.
//
// Seconds are padded to two digits only when there are minutes in front of them, which is
// what keeps a minute's worth of run reading as 1′05″ rather than 1′5″. Minutes are left
// unpadded and uncapped: an hour-long Trainee session reads as "62′04″" rather than
// wrapping into an hours column nothing else in the app has a slot for.
//
// Floors rather than rounds, so the number never claims a second of play that had not
// finished yet — the same reasoning `timeAgo` applies to a bucket boundary.

// U+2032 and U+2033, not an apostrophe and not two of them: each is one character, and
// the marks are indistinguishable from their typewriter lookalikes in this file and very
// distinguishable in the app. Named here rather than typed into a template.
const PRIME = '′'
const DOUBLE_PRIME = '″'

export function formatGameTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}${DOUBLE_PRIME}`
  return `${minutes}${PRIME}${String(seconds).padStart(2, '0')}${DOUBLE_PRIME}`
}

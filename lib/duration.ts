// A run's length, for the TIME cell on the pause and game over screens — 12″ under a
// minute, 1′12″ over one, 1ʰ02′04″ over an hour. The unit marks rather than a colon: a
// colon is what a clock uses, and the cell sits in a row of figures beside HITS and two
// percentages, where "12:04" read as a time of day rather than as a length. Prime and
// double prime are how a duration is written wherever one is timed.
//
// A run shorter than a minute says only its seconds. "0′12″" spends its first two
// characters saying there is nothing to say, in a cell whose whole job is to be read at a
// glance — and every first run, every run that ended on the opening target, is one of
// these. An hour behaves the same way: it appears once there is one, not before.
//
// Each figure is padded to two digits only when there is a larger one in front of it,
// which is what keeps a minute's worth of run reading as 1′05″ rather than 1′5″ and an
// hour's as 1ʰ00′00″. The leading figure is left unpadded and uncapped: a lifetime total
// reads as 247ʰ38′12″ rather than wrapping into a days column nothing in the app has a
// slot for.
//
// Floors rather than rounds, so the number never claims a second of play that had not
// finished yet — the same reasoning `timeAgo` applies to a bucket boundary.

// U+02B0, U+2032 and U+2033, not a letter h and not an apostrophe and not two of them:
// each is one character, and the marks are indistinguishable from their typewriter
// lookalikes in this file and very distinguishable in the app. There is no prime for an
// hour — ′ and ″ are minutes and seconds, and a triple prime is a *third* of a second —
// so the hour takes the modifier letter the sexagesimal notation gives it. Named here
// rather than typed into a template.
const HOUR_MARK = 'ʰ'
const PRIME = '′'
const DOUBLE_PRIME = '″'

const pad = (value: number): string => String(value).padStart(2, '0')

export function formatGameTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  // Padded, since every branch that reaches for it has a larger figure in front of it.
  const tail = `${pad(seconds)}${DOUBLE_PRIME}`
  if (hours > 0) return `${hours}${HOUR_MARK}${pad(minutes)}${PRIME}${tail}`
  if (minutes > 0) return `${minutes}${PRIME}${tail}`
  return `${seconds}${DOUBLE_PRIME}`
}

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

// U+1D48, the modifier letter the hour's ʰ already comes from, so a day joins the row
// without a second convention. A day has no prime of its own — the primes are a division
// of the hour, not a multiplication of it.
const DAY_MARK = 'ᵈ'

// A career's length, and a challenge window's: its largest whole unit and the one under
// it, and nothing under that — 12ᵈ07ʰ, 7ʰ38′, 40′12″, 12″.
//
// The run stats want every figure, because a run is a thing a player watched happen and
// the seconds of it are what they were counting. A career is not, and neither is a window
// a day long: the seconds of 247ʰ38′12″ are a precision nothing asked of a figure read at
// a glance, in the narrowest cell of its row.
//
// Two units rather than one, which is the whole of the difference between this and a bare
// largest unit. One is too coarse to be read as a quantity: a window that says 7ʰ says the
// same thing for an hour at a time, and a career that says 12ᵈ says it for a day — so the
// figure a player looks at twice has not moved, and the thing it is measuring looks stuck.
// The second unit is what makes it a measurement rather than a bracket.
//
// The smaller figure is padded and the leading one is not, which is `formatGameTime`'s own
// rule in this file: a larger figure in front of a smaller one means the smaller one is
// part of a number rather than a number of its own, so 7ʰ08′ and never 7ʰ8′.
//
// Seconds are the floor and the one case that prints a single unit, there being nothing
// under them to add. Days arrive here and not in `formatGameTime` for the reason the hour
// is held back there: a day column would push a run's own stats into a unit no run ever
// reaches, while a career crosses one.
//
// Floors, as everything in this file does. A career a second short of an hour says 59′59″
// rather than claiming the hour it had not finished.
export function formatCareerTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60)
  if (days > 0) return `${days}${DAY_MARK}${pad(hours % 24)}${HOUR_MARK}`
  if (hours > 0) return `${hours}${HOUR_MARK}${pad(minutes % 60)}${PRIME}`
  if (minutes > 0) return `${minutes}${PRIME}${pad(totalSeconds % 60)}${DOUBLE_PRIME}`
  return `${totalSeconds}${DOUBLE_PRIME}`
}

// Time left, as a clock: 1:52 with an hour or more to run, 52:09 under one, 0:09 in the
// last minute.
//
// A colon here, where `formatGameTime` refuses one — and the two are opposites on
// purpose. That function writes a *length*, in a row of figures where "12:04" would have
// read as a time of day; this one writes a *countdown*, which is the one thing in the app
// that genuinely is a clock running down, and prime marks on it would read as a duration
// somebody had measured rather than as time the player is losing.
//
// Two figures and never three. A clock face that gains a column mid-countdown is a figure
// that changes width and meaning at once — the first number means hours at 1:52:09 and
// minutes at 52:09 — and the pair that matters is always the two at the top: with an hour
// left nobody is reading the seconds, and under one the seconds are the whole of the
// urgency. So the seconds give way to the hour rather than standing beside it.
//
// Hours are the largest unit and are left uncapped. There is no days column: the one thing
// counted down to in this app is a challenge window, which is a day long — a 1ᵈ that sat
// there unmoving for its first hour would say less than the 25:00 it replaced. A career's
// total, which does cross days, is `formatCareerTime` above and keeps its unit marks.
//
// Minutes always show, even under one, so the figure never shrinks to a single number and
// back — a countdown that goes from "1:00" to "59" has changed shape in front of the
// player at the exact moment they are watching it.
//
// Clamped at zero rather than going negative: a window that shut while the card was on
// screen says 0:00 until the screen next reads which sessions are open.
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${pad(minutes)}`
  return `${minutes}:${pad(seconds)}`
}

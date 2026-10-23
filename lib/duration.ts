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

// The run clock as the **readout** draws it, on the screen a timed run stops on.
//
// One decimal — tenths, the same grain the session board settles places on (see
// `formatRaceTime`) — in the one notation the seven-segment
// face can actually draw: a colon rather than the prime marks, because DSEG7 has digits,
// a point and a colon and nothing else. That is not a compromise here — a colon is this
// file's mark for a figure that is a *clock* rather than a measured length, which is
// exactly what a readout counting a race is. See `formatCountdown`, which takes it for
// the same reason.
//
// Used by both ends of a timed run: the stopwatch running in the top bar, and the
// readout on the screen the run stops at. One figure, so a player watching 12.3 climb
// finishes on 12.3 rather than on a differently-shaped version of it.
export function formatRunClock(ms: number): string {
  const safe = Math.max(0, ms)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor(safe / 1000) % 60
  const tenths = Math.floor(safe / 100) % 10
  if (minutes > 0) return `${minutes}:${pad(seconds)}.${tenths}`
  return `${seconds}.${tenths}`
}

// What a run took, on a **session board** measured by the clock.
//
// A tenth of a second, where `formatGameTime` below gives whole ones. The difference is
// what the figure is for: that one is a stat on a card nobody compares, and this is the
// column a contest is decided in — nine targets take a few seconds, so whole seconds
// would put half the field on the same number and settle the places on the tie-break
// instead of on the run.
//
// Past a minute it falls back to the coarser form. A run that long on a drill is not a
// contender and a tenth of a second says nothing about it; what a reader wants there is
// to see at a glance that it is out of the running.
export function formatRaceTime(ms: number): string {
  const safe = Math.max(0, ms)
  if (safe >= 60_000) return formatGameTime(safe)
  // The stopwatch's own figure, never rounded: it read 9.0 at the finish, and the
  // standings saying 9.1 for the same run looked like a different time.
  return `${formatRunClock(safe)}${DOUBLE_PRIME}`
}

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

// Time left, as a clock: 1:52:09 with an hour or more to run, 52:09 under one, 0:09 in
// the last minute.
//
// A colon here, where `formatGameTime` refuses one — and the two are opposites on
// purpose. That function writes a *length*, in a row of figures where "12:04" would have
// read as a time of day; this one writes a *countdown*, which is the one thing in the app
// that genuinely is a clock running down, and prime marks on it would read as a duration
// somebody had measured rather than as time the player is losing.
//
// **The seconds always show.** This held two figures and never three for a while, on the
// reasoning that the pair at the top is the pair that matters — with an hour left nobody
// reads the second hand, and the figure is easier for losing it. That is true of the
// figure and wrong about the card it stands on: the countdown is drawn as a split-flap
// board on the intro, and a board whose last column never turns reads as a clock that has
// stopped. A window plainly running is most of what the banner is for, so the seconds are
// there to move rather than to be read.
//
// The cost is a figure that changes width when the hour column arrives or goes, and the
// first number changing meaning with it — hours at 1:52:09, minutes at 52:09. Accepted:
// it happens once per window, and the alternative was a still board for all but the last
// hour of one.
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
  // The seconds stand beside the hour rather than giving way to it, which is the opposite
  // of what this did. The reasoning for dropping them was that nobody reads a second hand
  // with an hour still to go — true of the *figure*, and wrong about the card. A board
  // whose last column is still is a board that looks stopped, and a window that is
  // plainly running is the whole of what the thing is for. So the seconds are there to
  // move, not to be read.
  //
  // Still no days column: see the note below.
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

// How long a window is open for, as a length rather than a clock: 24ʰ for the usual
// session, 36ʰ for one that runs over, 3ᵈ for one that is really a weekend.
//
// Hours all the way to two days, and days after that. A session in this app is a day
// long, so the figure that has to read instantly is the one-day case — and "1ᵈ00ʰ" spends
// its characters saying that a day is a day, where "24ʰ" is the number the admin typed
// into the form. Past two days the hours stop being interesting and the days start:
// nobody books a four-day window and then counts its hours.
//
// Minutes never appear. A window is planned in whole hours from a form that opens on noon
// to noon, and a session showing 23ʰ59′ would be reporting the rounding of the clock that
// drew it rather than anything anybody chose. The one figure that counts minutes here is
// the countdown, which is a different thing: time left, not length.
//
// Floors, as everything in this file does, and clamps at nought — a span whose end is not
// after its start is a form in the middle of being filled in, which `isValidSpan` is what
// refuses.
export function formatWindowLength(ms: number): string {
  const hours = Math.floor(Math.max(0, ms) / 3_600_000)
  if (hours < 48) return `${hours}${HOUR_MARK}`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest === 0 ? `${days}${DAY_MARK}` : `${days}${DAY_MARK}${pad(rest)}${HOUR_MARK}`
}

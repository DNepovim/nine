import { SUM_DIGIT_SIZE, SUM_DIGIT_TRACKING } from '@/constants/game'

export type Point = { x: number; y: number }

// What a strike fires is the mode's own answer now — `shot` on its definition, so a
// challenge inherits the shot of the mode it is based on. See modes/types.ts.

// How far above the sum row's middle the tops of its digits stand. A monospaced digit's
// ink is about three quarters of its size and sits a little low in its line box, so its
// top is ~0.38 of the size above the row's centre — 16pt at the sum's 42.
//
// A sniper fires from here rather than from the row's centre. Fired from the centre with
// a fixed gap, the beam only cleared the digits when it went straight up: aimed at a
// target out to the side, it started beside the number, level with its middle.
export const SUM_TOP = Math.round(SUM_DIGIT_SIZE * 0.38)

// How wide one of the sum's digits stands: a monospaced advance is 0.6 of the size, and
// the tracking goes after every digit.
const SUM_DIGIT_ADVANCE = SUM_DIGIT_SIZE * 0.6 + SUM_DIGIT_TRACKING

// The beam touches neither end. It starts a little air clear of the digits it is fired
// from, and stops short of the target's rim rather than landing on it. A line drawn
// hard into both ends read as a tether between two things; one with air at each end
// reads as a shot crossing the gap between them.
const BEAM_START_GAP = 4
export const BEAM_END_CLEARANCE = 8

// How far along its ray a sniper's beam starts, from the top centre of a sum `digits`
// long. Whichever comes first: the beam rising `BEAM_START_GAP` above the digits' tops,
// or passing `BEAM_START_GAP` beyond the side of the number. Straight up that is the gap
// itself; aimed nearly level it is the number's half-width, so a shallow beam leaves
// from beside a three-digit sum rather than skimming across the tops of its digits.
// `angle` is the ray's, in degrees with +Y downwards, as `shotLine` gives it.
export function sniperStartGap(angle: number, digits: number): number {
  const radians = (angle * Math.PI) / 180
  const across = Math.abs(Math.cos(radians))
  const rise = -Math.sin(radians)
  const side = (digits * SUM_DIGIT_ADVANCE) / 2 + BEAM_START_GAP
  const pastSide = across > 0 ? side / across : Number.POSITIVE_INFINITY
  const aboveTop = rise > 0 ? BEAM_START_GAP / rise : Number.POSITIVE_INFINITY
  return Math.min(pastSide, aboveTop)
}

// What is left when a target is so close to the sum row that the two gaps would eat the
// whole distance. Better a short beam held in the middle of the run than a bar drawn
// backwards, which is what the arithmetic gives without this.
const MIN_BEAM = 16

// The sniper's three beats. Drawn almost instantly, held while the target goes, gone
// before the next press can land — the hold is the shot, the draw is just how it gets
// there.
export const SNIPER_DRAW_MS = 70
export const SNIPER_HOLD_MS = 140
export const SNIPER_FADE_MS = 210
export const SNIPER_MS = SNIPER_DRAW_MS + SNIPER_HOLD_MS + SNIPER_FADE_MS

// The burst. Five rounds thirty milliseconds apart is fast enough to read as automatic
// rather than as five aimed shots, and the whole thing is over in 230ms — well inside
// the gap between two hits at Speed's hardest cadence.
export const BURST_ROUNDS = 5
export const BURST_CADENCE_MS = 30
export const BURST_ROUND_MS = 110
export const BURST_MS = BURST_CADENCE_MS * (BURST_ROUNDS - 1) + BURST_ROUND_MS

// How much of the target's radius the rounds spread over. Under 1 on purpose: the
// rounds land on the face, and a round that reached the rim would read as a miss.
const BURST_SPREAD = 0.7

// Where a round starts and ends its travel, as fractions of the distance to what it is
// aimed at. It never arrives — a round is a short streak crossing the gap, not a line
// joining the two ends, which is what keeps five of them from reading as a fan of beams.
export const ROUND_FROM = 0.1
export const ROUND_TO = 0.72
export const ROUND_LENGTH = 0.3

// The ray a shot travels: how far the muzzle is from what it is aimed at, and the
// angle to turn a flat bar through to lie along it. Degrees, because a rotate transform
// takes degrees — and measured the way the screen measures, with +Y downwards, so a
// target above the sum comes back as a quarter turn back.
export type ShotLine = { length: number; angle: number }

export const shotLine = (from: Point, to: Point): ShotLine => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return { length: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI }
}

// Where along its ray a beam actually draws: how far from the muzzle it starts, and how
// much of the ray it covers. Split from the ray itself because the gaps are a look and
// the ray is a fact — the angle is the same either way.
export type InsetLine = { offset: number; length: number }

export const insetLine = (
  length: number,
  startGap: number,
  endGap: number,
): InsetLine => {
  const span = length - startGap - endGap
  if (span >= MIN_BEAM) return { offset: startGap, length: span }
  // Too close to hold both gaps: keep what is left centred on the ray, so the beam
  // shortens from both ends at once rather than sliding out of one of them.
  const kept = Math.min(MIN_BEAM, length)
  return { offset: Math.max(0, (length - kept) / 2), length: kept }
}

// One round of a burst: its own ray, and when it leaves the muzzle.
export type BurstRound = ShotLine & { delay: number }

// Which rounds of the press's one burst each hit target gets. A press can take several
// targets at once, and firing a full burst at each would turn one strike into three —
// so the rounds are dealt round-robin instead, and the stream sweeps between targets
// while staying a single burst on a single cadence.
export const shareRounds = (targetCount: number): number[][] => {
  if (targetCount <= 0) return []
  const share: number[][] = Array.from({ length: targetCount }, () => [])
  for (let round = 0; round < BURST_ROUNDS; round++) {
    share[round % targetCount]?.push(round)
  }
  return share
}

// The rays of one target's share of a burst, spread across its face rather than all
// aimed at its middle — that spread is the whole difference between a burst and one
// thick beam. `indices` are the rounds of the press this target owns, so the delays
// come from the burst's own count while the spread comes from this target's share.
export function burstRounds(
  from: Point,
  center: Point,
  radius: number,
  indices: readonly number[],
): BurstRound[] {
  const straight = shotLine(from, center)
  // The unit vector across the line of fire, which is what an aim point is offset along.
  const radians = (straight.angle * Math.PI) / 180
  const acrossX = -Math.sin(radians)
  const acrossY = Math.cos(radians)
  const last = indices.length - 1
  return indices.map((index, position) => {
    // -1 at one edge of the face through +1 at the other; a lone round sits dead centre.
    const spread = last === 0 ? 0 : (position / last) * 2 - 1
    const reach = spread * radius * BURST_SPREAD
    const aim = { x: center.x + acrossX * reach, y: center.y + acrossY * reach }
    return { ...shotLine(from, aim), delay: index * BURST_CADENCE_MS }
  })
}

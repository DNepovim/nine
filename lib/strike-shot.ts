import { APP_RED, GOLD_SCALE } from '@/constants/colors'
import type { Mode } from '@/machines/modes'

export type Point = { x: number; y: number }

// What a strike fires. The two scored modes each get the shot their streak is made of:
// Accuracy's chain is one exact press after another, so it draws a single held beam;
// Speed's is a run of fast ones, so it empties a magazine. Trainee fires nothing at all
// — its streak is the legacy board-clear rule rather than a chain of decisions, and the
// sum's answering ring is the whole event there.
export type ShotKind = 'sniper' | 'burst'

export const MODE_SHOT = {
  trainee: null,
  accuracy: 'sniper',
  speed: 'burst',
} as const satisfies Record<Mode, ShotKind | null>

// The beam runs hot at the muzzle and cools along its length: the brightest stop of the
// gold the app already marks records in, through to the app's own red. Both are existing
// game colours rather than a generic laser's, and both are mid-tone, so the beam reads
// on the light surface and the dark one without a variant.
export const BEAM_GRADIENT = [GOLD_SCALE[0], APP_RED] as const

// Speed's rounds are the end of that same ramp — the mode's own hue, which is this red.
export const BURST_COLOR = APP_RED

// The beam touches neither end. It starts clear of the digits it is fired from — the
// sum stands 42pt tall, so this is half of that and a little air — and stops short of
// the target's rim rather than landing on it. A line drawn hard into both ends read as
// a tether between two things; one with air at each end reads as a shot crossing the
// gap between them.
export const BEAM_START_GAP = 28
export const BEAM_END_CLEARANCE = 8

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

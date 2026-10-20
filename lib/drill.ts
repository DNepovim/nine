import { CARD_GAP, PIE_SIZE } from '@/constants/game'
import { fullRange, pickTargetValue } from '@/lib/target-value'
import type { DialSpec } from '@/modes'
import type { Position } from '@/types/game'

// A **drill**: the fixed list of targets a session deals — the same values, in the same
// order, in the same places, for every player and every run of that session.
//
// Everything here is derived from the session's own id, which is the whole trick. A
// session is a row with a uuid on it, the dialog already hands that uuid to the run it
// starts, and a rerun of the same challenge is a different row and so a different drill.
// There is nothing to store, nothing to plan, and nothing an admin can get wrong.
//
// Two halves, because they answer two different questions. The **values** are a fact
// about the session alone: the same nine wherever they are drawn. The **places** are a
// fact about the session *and* the canvas, because nine cards have to fit the board they
// are standing on and a phone's board is not a tablet's. Two runs on one device are
// therefore identical, which is what a player actually experiences; a different display
// gets the same nine in the same order and a scatter of its own.

// One card of a drill: which of the nine it is, how big it is drawn, and where it
// stands. The index rides along because the cards are arranged largest-first and handed
// back in dealing order, and because it is what a card's colour is looked up by.
export type DrillPlace = { index: number; size: number; at: Position }

// The smallest a target card may be drawn before the number on it stops being readable.
//
// Three digits of DSEG7 inside a ring, which is what a dial reaching 324 deals. Below
// this the scatter gives ground instead — a slightly tighter board beats a target nobody
// can read, and the cards never overlap either way.
export const DRILL_MIN_SIZE = 52

// A 32-bit hash of a string, so a uuid becomes a number the generator below can start
// from. FNV-1a: short, no dependency, and spreads the two uuids that differ in one
// character into two unrelated drills.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// A deterministic stream of rolls in [0, 1) — mulberry32, which is the smallest
// generator worth having and is exactly as repeatable as the seed it was started from.
//
// `Math.random` is what the spawner and `findPosition` use, and it is the reason a
// challenge cannot currently put the same board in front of two players. This replaces
// it for a drilled run and nothing else.
function rollsFrom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The drill a run deals from, or null for a mode that rolls its targets.
//
// **Null only when the mode has no drill.** It used to be null without a session too,
// on the reasoning that a drill comes from a session's id and a run outside one has no
// id to take — and that was the wrong answer, quietly. A drilled mode reached any other
// way than the challenge dialog fell all the way back to rolling: random targets, a
// respawn the instant the board cleared, and a card replaced the moment it was hit.
// Which is the one thing a drill must never look like, arrived at by a run simply not
// knowing which session it belonged to.
//
// So the mode's own id is the fallback seed. A drilled mode is always drilled; what a
// session changes is only *which* nine. Every door into the mode — the dialog, a mode
// pill once its window opens, PLAY AGAIN, a dev screen — now deals a fixed board.
export const drillFor = (
  rules: { spawn: { drill: number | null } },
  modeId: string,
  sessionId: string | null,
): { seed: string; count: number } | null =>
  rules.spawn.drill === null
    ? null
    : { seed: sessionId ?? modeId, count: rules.spawn.drill }

// The nine a session deals, in the order it deals them.
//
// Drawn through `pickTargetValue` rather than rolled directly, so a drill obeys the same
// two rules every spawned target obeys: it stays inside the range the dial reaches, and
// it is never a value already standing. Nought is excluded on top of that — the dial
// opens on a grid of zeros, so a target of nought would be hit before the player touched
// anything.
export function drillValues(seed: string, dial: DialSpec, count: number): number[] {
  const roll = rollsFrom(hashSeed(seed))
  const range = fullRange(dial)
  const values: number[] = []
  for (let index = 0; index < count; index++) {
    values.push(pickTargetValue({ roll: roll(), taken: [0, ...values], range }))
  }
  return values
}

// How much smaller the smallest card in a drill is than the largest.
//
// A drill's cards differ in size, and that is a memory aid rather than decoration: a
// fixed nine is learnt as a shape, and a shape made of one repeated circle is nine
// positions to remember where a shape made of different circles is one picture. Kept
// narrow — below about three-quarters the big ones start reading as nearer and the board
// stops being flat.
const SMALLEST = 0.76

// How much of the room a perfect grid would need the scatter actually takes.
//
// Nine cards packed three by three use every pixel of their box, which leaves a scatter
// nowhere to be irregular in. This is the slack that buys the jitter, and it is why the
// cards come out noticeably smaller than a grid of nine would be.
const SCATTER_ROOM = 0.86

// How many darts to throw per card before giving up on a gap and trying a smaller one.
const THROWS = 250

// The largest card a drill draws on this canvas.
//
// Measured against the grid the cards would have to fall into if they were packed — the
// honest constraint, because nine axis-aligned squares cannot fit a box narrower than
// three of them however cleverly they are placed. Area alone is not enough and was the
// bug this replaces: it answered with a size nine cards could never be arranged at, so
// the scatter gave up and let them overlap.
export function drillSize(count: number, width: number, height: number): number {
  if (width <= 0 || height <= 0) return PIE_SIZE
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const fits = Math.min(
    (width - (cols + 1) * CARD_GAP) / cols,
    (height - (rows + 1) * CARD_GAP) / rows,
  )
  return Math.max(DRILL_MIN_SIZE, Math.min(PIE_SIZE, Math.floor(fits * SCATTER_ROOM)))
}

// Whether two cards would touch, with `gap` of air demanded between them.
//
// An axis-aligned overlap test, and the distinction matters: the first version of this
// compared the distance between two cards' **top-left corners** against one card's
// width, which two squares can satisfy while plainly overlapping — put one card's corner
// at (0.7s, 0.7s) from another's and the distance clears `s` while the boxes share a
// quarter of their area. That is what put 64 across 65 on the board, and the test that
// was supposed to catch it asserted the same wrong thing.
const touches = (a: DrillPlace, b: DrillPlace, gap: number): boolean =>
  a.at.x < b.at.x + b.size + gap &&
  a.at.x + a.size + gap > b.at.x &&
  a.at.y < b.at.y + b.size + gap &&
  a.at.y + a.size + gap > b.at.y

// Where the drill's cards stand on a canvas of this size, and how big each one is.
//
// A seeded dart-throw — pick a spot, keep it if it clears everything already down,
// otherwise roll again — rather than a lattice. Irregular by construction and incapable
// of overlapping, which is the pair of things a grid cannot give at once: a grid is the
// one arrangement that would make nine fixed places read as nine fixed places rather
// than as a board.
//
// **Largest first.** A big card thrown last has nowhere left to land, so the order is by
// size and not by index — the places come back in index order either way.
//
// Three things give way in turn when the throws run out, and the order is deliberate:
// first the **gap** between cards, down to nothing; then the **size**, a step at a time.
// Only when both are spent does it fall back to a grid, which is plainly a grid and so
// says the board is too small rather than that somebody chose this.
export function drillPlaces(
  seed: string,
  count: number,
  width: number,
  height: number,
): readonly DrillPlace[] {
  const base = drillSize(count, width, height)

  // Started from a seed of its own so the places do not shift when the values do: the
  // two halves of a drill are derived separately, and a dial that changed its range
  // would otherwise also move every card on the board.
  const roll = rollsFrom(hashSeed(`${seed}:places`))
  // Rolled once, before any arranging, so a card is the same size however many times
  // the arrangement is retried below.
  const scales = Array.from({ length: count }, () => SMALLEST + roll() * (1 - SMALLEST))

  for (let shrink = 0; shrink < 6; shrink++) {
    const top = base * (1 - shrink * 0.07)
    const sizes = scales.map((scale) => Math.max(DRILL_MIN_SIZE, Math.round(top * scale)))
    // Biggest first, index breaking ties, so the walk is the same every run.
    const order = sizes
      .map((size, index) => ({ size, index }))
      .sort((a, b) => b.size - a.size || a.index - b.index)

    for (let loose = 0; loose <= CARD_GAP; loose++) {
      const gap = CARD_GAP - loose
      // Thrown from a fresh stream per attempt, so the arrangement is a function of the
      // seed and the canvas and not of how many attempts came before it.
      const throwAt = rollsFrom(hashSeed(`${seed}:places:${shrink}:${gap}`))
      const placed: DrillPlace[] = []
      for (const { size, index } of order) {
        for (let attempt = 0; attempt < THROWS; attempt++) {
          const spot: DrillPlace = {
            index,
            size,
            at: {
              x: throwAt() * Math.max(0, width - size),
              y: throwAt() * Math.max(0, height - size),
            },
          }
          if (placed.every((other) => !touches(spot, other, gap))) {
            placed.push(spot)
            break
          }
        }
      }
      if (placed.length === count) {
        return [...placed].sort((a, b) => a.index - b.index)
      }
    }
  }

  // Every size and every gap ran out of throws, so the canvas genuinely cannot hold this
  // many cards apart. A row-major fallback at the smallest size: still a place of its
  // own for every card, still the same place every run, and plainly a grid.
  const size = Math.max(DRILL_MIN_SIZE, Math.round(base * SMALLEST))
  const perRow = Math.max(1, Math.floor(width / (size + CARD_GAP)))
  return Array.from({ length: count }, (_, index) => ({
    index,
    size,
    at: {
      x: Math.min(Math.max(0, width - size), (index % perRow) * (size + CARD_GAP)),
      y: Math.min(
        Math.max(0, height - size),
        Math.floor(index / perRow) * (size + CARD_GAP),
      ),
    },
  }))
}

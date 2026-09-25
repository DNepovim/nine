import { isArray, isDefined, isNotNull, isNumber, isObject, isOneOf } from 'narrowland'

import {
  DIFFICULTY_ORDER,
  MODE_ORDER,
  MODES,
  type Difficulty,
  type Grid,
  type Mode,
  type RestoredRun,
} from '@/machines/game'
import type { DisplayTarget, Position } from '@/types/game'

// A run the app was closed on, written down so the next launch can put it back.
//
// Timestamps are the whole difficulty. A target carries the moment it spawned, and the
// ring the player watches is `now - spawnedAt` measured against its duration — a reading
// that only means anything inside the session it was taken in. Stored and read back
// tomorrow it says every target ran out while the phone was in a pocket.
//
// So nothing written here is a moment. The two clocks a target keeps are put down as
// ages, measured at the instant the run was put away, and laid back against whatever
// `now` the app comes back to. The run returns holding exactly the sliver of clock it
// was closed on, which is the promise the pause screen already makes: a paused run has
// no clock running, and a target keeps what it had left until the player says go.
type SavedTarget = {
  id: number
  value: number
  duration: number
  // Milliseconds since this target spawned, and since its reference moment, as of the
  // instant the run was put away — see the note above.
  age: number
  refAge: number
  refGrid: Grid
  par: number
  userSteps: number
  // Where the card was sitting on the board. Not the machine's business — placement
  // belongs to the display list (hooks/use-displayed-targets.ts) — so it is handed in
  // rather than read off the run, and null for a target that arrived in the very frame
  // the app was closed on and had not been placed yet.
  position: Position | null
}

export type SavedRun = {
  mode: Mode
  difficulty: Difficulty
  grid: Grid
  hits: number
  score: number
  // Null for a mode that never spends them. Trainee's lives are Infinity, which JSON
  // writes as `null` whether it is asked to or not — written that way deliberately so
  // reading it back is a rule rather than a coincidence, and filled in from the mode on
  // the way out, so a run put away under one set of lives comes back under the set in
  // force now.
  lives: number | null
  streak: number
  maxStreak: number
  strikes: number
  accSum: number
  spdSum: number
  elapsedMs: number
  nextTargetId: number
  runSeq: number
  targets: SavedTarget[]
}

// Everything `toSavedRun` reads off the machine's context. `playingSince` is in here and
// not in `RestoredRun` because a run can be put away while it is still running — a hard
// kill, a browser tab closed without warning — and the stretch since that moment is time
// played that has yet to reach `elapsedMs`.
export type RunSnapshot = RestoredRun & { playingSince: number | null }

const isFigure = (value: unknown): value is number =>
  isNumber(value) && Number.isFinite(value)

const isDigit = (value: unknown): value is number =>
  isFigure(value) && Number.isInteger(value) && value >= 0 && value <= 9

// Three of something, or nothing. The grid is three rows and a row is three digits, and
// `noUncheckedIndexedAccess` means neither can be read off an array without this anyway.
const three = <T>(values: (T | null)[]): [T, T, T] | null => {
  if (values.length !== 3) return null
  const [first, second, third] = values
  if (!isDefined(first) || !isDefined(second) || !isDefined(third)) return null
  return [first, second, third]
}

const parseRow = (value: unknown): [number, number, number] | null =>
  isArray(value) ? three(value.map((cell) => (isDigit(cell) ? cell : null))) : null

const parseGrid = (value: unknown): Grid | null =>
  isArray(value) ? three(value.map(parseRow)) : null

// Null is a real answer — the mode that never spends them — so a value that failed to
// parse has to be something else again.
const parseLives = (value: unknown): number | null | undefined => {
  if (value === null) return null
  return isFigure(value) ? value : undefined
}

const parsePosition = (value: unknown): Position | null => {
  if (!isObject<Record<string, unknown>>(value)) return null
  const { x, y } = value
  if (!isFigure(x) || !isFigure(y)) return null
  return { x, y }
}

const parseTarget = (value: unknown): SavedTarget | null => {
  if (!isObject<Record<string, unknown>>(value)) return null
  const refGrid = parseGrid(value.refGrid)
  const { id, duration, age, refAge, par, userSteps } = value
  const dialled = value.value
  if (refGrid === null) return null
  if (!isFigure(id) || !isFigure(dialled) || !isFigure(duration)) return null
  if (!isFigure(age) || !isFigure(refAge)) return null
  if (!isFigure(par) || !isFigure(userSteps)) return null
  return {
    id,
    value: dialled,
    duration,
    age,
    refAge,
    refGrid,
    par,
    userSteps,
    // A spot that would not parse costs the target its place on the board and nothing
    // else: it is put back somewhere clear instead. Losing the whole run over it would
    // be trading the game for the furniture.
    position: parsePosition(value.position),
  }
}

// Where each live target is sitting, by id, as the display list has them. Targets on
// their way off are left out: what they are playing is an exit, and there is nothing to
// come back to.
export function positionsOf(
  placed: readonly DisplayTarget[],
): ReadonlyMap<number, Position> {
  const spots = new Map<number, Position>()
  for (const target of placed) {
    if (target.exit === null) spots.set(target.id, target.position)
  }
  return spots
}

// The same lookup, read back off a stored run — what the display list places from.
export function savedPositions(saved: SavedRun): ReadonlyMap<number, Position> {
  const spots = new Map<number, Position>()
  for (const target of saved.targets) {
    if (target.position !== null) spots.set(target.id, target.position)
  }
  return spots
}

// Takes the run as the machine holds it and turns it into something a launch tomorrow
// can read. `now` is the moment it is being put away, which is what every age is
// measured against; `positions` is where the display list had each target sitting, so
// the board comes back arranged the way it was left.
export function toSavedRun(
  run: RunSnapshot,
  positions: ReadonlyMap<number, Position>,
  now: number,
): SavedRun {
  return {
    mode: run.mode,
    difficulty: run.difficulty,
    grid: run.grid,
    hits: run.hits,
    score: run.score,
    lives: Number.isFinite(run.lives) ? run.lives : null,
    streak: run.streak,
    maxStreak: run.maxStreak,
    strikes: run.strikes,
    accSum: run.accSum,
    spdSum: run.spdSum,
    // The same fold every exit from `playing` does to the clock, because this is one.
    // A run closed on while it was still running has a stretch of play the context has
    // not banked yet, and losing it would hand the player back a shorter run than the
    // one they left.
    elapsedMs: run.elapsedMs + (now - (run.playingSince ?? now)),
    nextTargetId: run.nextTargetId,
    runSeq: run.runSeq,
    targets: run.targets.map((target) => ({
      id: target.id,
      value: target.value,
      duration: target.duration,
      // Clamped at zero against a device clock that moved backwards between the two
      // launches: a negative age is a target that spawned in the future, and the ring
      // it would draw is fuller than the one the player was looking at.
      age: Math.max(0, now - target.spawnedAt),
      refAge: Math.max(0, now - target.refAt),
      refGrid: target.refGrid,
      par: target.par,
      userSteps: target.userSteps,
      position: positions.get(target.id) ?? null,
    })),
  }
}

// Whatever came back off the device, or nothing. Nothing is always a safe answer: the
// player lands on the intro, which is where every launch used to land.
export function parseSavedRun(value: unknown): SavedRun | null {
  if (!isObject<Record<string, unknown>>(value)) return null
  const { mode, difficulty } = value
  if (!isOneOf(mode, MODE_ORDER) || !isOneOf(difficulty, DIFFICULTY_ORDER)) return null

  const grid = parseGrid(value.grid)
  if (grid === null) return null

  const lives = parseLives(value.lives)
  if (lives === undefined) return null

  if (!isArray(value.targets)) return null
  const targets = value.targets.map(parseTarget).filter(isNotNull)
  // One target that would not parse discards the whole run rather than the target: a
  // board missing one of the things on it is a run the player never played.
  if (targets.length !== value.targets.length) return null

  const { hits, score, streak, maxStreak, strikes } = value
  const { accSum, spdSum, elapsedMs, nextTargetId, runSeq } = value
  if (!isFigure(hits) || !isFigure(score)) return null
  if (!isFigure(streak) || !isFigure(maxStreak) || !isFigure(strikes)) return null
  if (!isFigure(accSum) || !isFigure(spdSum) || !isFigure(elapsedMs)) return null
  if (!isFigure(nextTargetId) || !isFigure(runSeq)) return null

  return {
    mode,
    difficulty,
    grid,
    hits,
    score,
    lives,
    streak,
    maxStreak,
    strikes,
    accSum,
    spdSum,
    elapsedMs,
    nextTargetId,
    runSeq,
    targets,
  }
}

// Lays the stored ages back down against the clock the app has come back to. `now` is
// the moment the run is being handed to the machine.
export function restoreRun(saved: SavedRun, now: number): RestoredRun {
  return {
    mode: saved.mode,
    difficulty: saved.difficulty,
    grid: saved.grid,
    hits: saved.hits,
    score: saved.score,
    lives: saved.lives ?? MODES[saved.mode].lives,
    streak: saved.streak,
    maxStreak: saved.maxStreak,
    strikes: saved.strikes,
    accSum: saved.accSum,
    spdSum: saved.spdSum,
    elapsedMs: saved.elapsedMs,
    nextTargetId: saved.nextTargetId,
    runSeq: saved.runSeq,
    targets: saved.targets.map((target) => ({
      id: target.id,
      value: target.value,
      duration: target.duration,
      spawnedAt: now - target.age,
      refAt: now - target.refAge,
      refGrid: target.refGrid,
      par: target.par,
      userSteps: target.userSteps,
    })),
  }
}

import type { Grid } from './game'

// Points a perfect hit is worth before the accuracy/speed blend. Tunable.
const SCORE_BASE = 100

// Cell weights, row-major: (row+1) * (col+1). Matches computeSum in game.ts.
const WEIGHTS: number[] = [1, 2, 3, 2, 4, 6, 3, 6, 9]

// What one dial key multiplies its digit by. The dial needs it to label a button
// and the coach needs it to tell a fine key from a coarse one, so the formula lives
// here beside the weights it comes from rather than in three places.
export const cellWeight = (index: number): number => WEIGHTS[index] ?? 0

const MAX_SUM = 324 // 9 * sum(WEIGHTS)

// Minimum steps to change ONE button from value `a` to `f` using the available
// operations: +1 / -1 (wrapping 0↔9), jump →0, jump →9.
function stepCost(a: number, f: number): number {
  if (a === f) return 0
  const d = Math.abs(f - a)
  const wrap = Math.min(d, 10 - d) // ±1 either way, with wrap
  return Math.min(wrap, 1 + f, 1 + (9 - f))
}

// Minimum total steps to move the grid to ANY configuration whose weighted sum
// equals `target`. Steps decompose per button (each step touches one button and
// the final sum depends only on final values), so this is an exact small DP.
export function computePar(grid: Grid, target: number): number {
  if (target < 0 || target > MAX_SUM) return 0
  const values = grid.flat()
  const INF = Number.POSITIVE_INFINITY
  let dp = new Array<number>(MAX_SUM + 1).fill(INF)
  dp[0] = 0
  for (let i = 0; i < 9; i++) {
    const w = WEIGHTS[i] ?? 0
    const a = values[i] ?? 0
    const next = new Array<number>(MAX_SUM + 1).fill(INF)
    for (let s = 0; s <= MAX_SUM; s++) {
      const cur = dp[s] ?? INF
      if (cur === INF) continue
      for (let f = 0; f <= 9; f++) {
        const ns = s + w * f
        if (ns > MAX_SUM) break
        const cost = cur + stepCost(a, f)
        if (cost < (next[ns] ?? INF)) next[ns] = cost
      }
    }
    dp = next
  }
  return Number.isFinite(dp[target]) ? (dp[target] ?? 0) : 0
}

// One weight's share of an optimal route: how many steps to spend on keys of that
// weight. Steps rather than taps — a swipe to 0 or 9 is one step.
export type RouteStep = { weight: number; steps: number }

// One layer of the DP: the cheapest way to reach each running sum once this button
// has been decided, and the value it was set to in order to get there. -1 marks a sum
// this button could not produce.
type Layer = { costs: number[]; choice: number[] }

const INF = Number.POSITIVE_INFINITY

function extendLayer(costs: number[], weight: number, from: number): Layer {
  const next = new Array<number>(MAX_SUM + 1).fill(INF)
  const choice = new Array<number>(MAX_SUM + 1).fill(-1)
  for (let s = 0; s <= MAX_SUM; s++) {
    const cur = costs[s] ?? INF
    if (cur === INF) continue
    for (let f = 0; f <= 9; f++) {
      const sum = s + weight * f
      if (sum > MAX_SUM) break
      const cost = cur + stepCost(from, f)
      if (cost < (next[sum] ?? INF)) {
        next[sum] = cost
        choice[sum] = f
      }
    }
  }
  return { costs: next, choice }
}

// Walks the layers back from the target, totalling the steps each weight is owed.
//
// Keyed by weight rather than by button, because the two keys sharing a weight are
// interchangeable to the sum — a step on either moves the total by the same amount, so
// splitting them into "1× ②  ›  1× ②" reported the same instruction twice.
//
// Buttons already at the right value contribute nothing, and drop out.
function readRoute(
  values: number[],
  layers: Layer[],
  target: number,
): Map<number, number> {
  const byWeight = new Map<number, number>()
  let sum = target
  for (let i = 8; i >= 0; i--) {
    const value = layers[i]?.choice[sum] ?? -1
    if (value < 0) return new Map()
    const weight = WEIGHTS[i] ?? 0
    const steps = stepCost(values[i] ?? 0, value)
    if (steps > 0) byWeight.set(weight, (byWeight.get(weight) ?? 0) + steps)
    sum -= weight * value
  }
  return byWeight
}

// The route behind computePar — not just what the best solution costs but what it is.
//
// Same DP, keeping the value chosen for each button at each running sum so the answer
// can be walked back.
//
// Coarsest weight first, matching how the game is taught — get near the target with ×9
// and ×6, then trim with the fine keys.
export function computeRoute(grid: Grid, target: number): RouteStep[] {
  if (target < 0 || target > MAX_SUM) return []
  const values = grid.flat()

  const start = new Array<number>(MAX_SUM + 1).fill(INF)
  start[0] = 0
  const layers: Layer[] = []
  let costs = start
  for (let i = 0; i < 9; i++) {
    const layer = extendLayer(costs, WEIGHTS[i] ?? 0, values[i] ?? 0)
    layers.push(layer)
    costs = layer.costs
  }

  if (!Number.isFinite(costs[target] ?? INF)) return []

  return [...readRoute(values, layers, target)]
    .map(([weight, steps]) => ({ weight, steps }))
    .sort((a, b) => b.weight - a.weight)
}

// Gentler difference-based accuracy: 1 at optimal, decaying with wasted steps.
export function accuracyFactor(par: number, userSteps: number): number {
  const effectivePar = Math.max(par, 1)
  const excess = Math.max(0, userSteps - effectivePar)
  return Math.max(0, 1 - excess / (effectivePar + 2))
}

// 1 = hit instantly, 0 = hit at the buzzer. Stays linear because it doubles as the
// run's average-speed stat, which should report plain time left.
export function speedFactor(timeLeft: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(1, Math.max(0, timeLeft / duration))
}

// Where the extra reward starts, and how much a perfect instant hit adds on top.
export const FAST_BAND = 0.85
const FAST_BONUS = 0.25

// What a hit's speed is worth in points. Linear time-left up to the fast band, then
// rising past 1 — so landing a hit near-instantly pays visibly more than merely
// being quick, instead of the few percent a straight line would give.
export function speedReward(spd: number): number {
  if (spd <= FAST_BAND) return spd
  return spd + (FAST_BONUS * (spd - FAST_BAND)) / (1 - FAST_BAND)
}

// Trainee celebrates the hit rather than the run, and this is what earns it:
// either the hit was taken in optimal steps, or it was taken with most of the
// clock still to run. Either alone is worth marking — a learner who nails the
// route deserves the same nod as one who nails the timing.
//
// The accuracy side wants exactly optimal, not nearly: `accuracyFactor` returns 1
// only when no step was wasted, and softening that would celebrate a near miss.
const CLEAN_SPEED = 0.6

type Factors = { accFactor: number; spdFactor: number }

export const isCleanHit = (hit: Factors): boolean =>
  hit.accFactor === 1 || hit.spdFactor >= CLEAN_SPEED

// What a batch earned its celebration for, so the praise can name it. A batch is
// every target one press cleared, so it can manage both across two hits without
// either hit managing both — which still deserves the both-line.
export type CleanReason = 'accuracy' | 'speed' | 'both'

export function cleanHitReason(hits: readonly Factors[]): CleanReason | null {
  const accurate = hits.some((hit) => hit.accFactor === 1)
  const fast = hits.some((hit) => hit.spdFactor >= CLEAN_SPEED)
  if (accurate && fast) return 'both'
  if (accurate) return 'accuracy'
  if (fast) return 'speed'
  return null
}

// Points for a single hit, blending accuracy and speed per the mode's weights.
export function computeHitPoints(opts: {
  par: number
  userSteps: number
  timeLeft: number
  duration: number
  weights: { acc: number; spd: number }
  base?: number
}): number {
  const { par, userSteps, timeLeft, duration, weights, base = SCORE_BASE } = opts
  const acc = accuracyFactor(par, userSteps)
  const spd = speedReward(speedFactor(timeLeft, duration))
  return Math.round(base * (weights.acc * acc + weights.spd * spd))
}

import type { Grid } from './game'

// Points a perfect hit is worth before the accuracy/speed blend. Tunable.
const SCORE_BASE = 1000

// Cell weights, row-major: (row+1) * (col+1). Matches computeSum in game.ts.
const WEIGHTS: number[] = [1, 2, 3, 2, 4, 6, 3, 6, 9]

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

// Gentler difference-based accuracy: 1 at optimal, decaying with wasted steps.
function accuracyFactor(par: number, userSteps: number): number {
  const effectivePar = Math.max(par, 1)
  const excess = Math.max(0, userSteps - effectivePar)
  return Math.max(0, 1 - excess / (effectivePar + 2))
}

// 1 = hit instantly, 0 = hit at the buzzer.
function speedFactor(timeLeft: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.min(1, Math.max(0, timeLeft / duration))
}

// Points for a single hit, blending accuracy (2/3) and speed (1/3).
export function computeHitPoints(opts: {
  par: number
  userSteps: number
  timeLeft: number
  duration: number
  base?: number
}): number {
  const { par, userSteps, timeLeft, duration, base = SCORE_BASE } = opts
  const acc = accuracyFactor(par, userSteps)
  const spd = speedFactor(timeLeft, duration)
  return Math.round(base * ((2 / 3) * acc + (1 / 3) * spd))
}

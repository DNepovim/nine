import { cellCount, weightAt, type DialSpec, type Grid } from '@/modes/dial'

// Minimum steps to change ONE key from value `a` to `f` using the available operations:
// +1 / -1 (wrapping round the key's range), jump to the floor, jump to the ceiling.
//
// Kept as plain arithmetic rather than deferring to `movePlan`, which prices the same
// four routes but allocates to do it: this runs roughly thirty thousand times per
// `computePar`, and that runs on every spawn and every hit. A test holds the two to the
// same answer for all hundred pairs a ten-digit key can make.
export function stepCost(digits: number, a: number, f: number): number {
  if (a === f) return 0
  const d = Math.abs(f - a)
  const wrap = Math.min(d, digits - d) // ±1 either way, with wrap
  return Math.min(wrap, 1 + f, 1 + (digits - 1 - f))
}

// Minimum total steps to move the dial to ANY position whose weighted sum equals each
// reachable sum — the whole table at once. Steps decompose per key (each step touches
// one key and the final sum depends only on final values), so this is an exact small DP,
// and the table is what the DP naturally produces.
//
// A sum no arrangement reaches holds `Infinity`. Callers decide what that means:
// `computePar` answers 0, and arcade passes the sum over.
//
// Exported because arcade asks the question the other way round. A crossroad is two to
// four targets chosen *by* what they cost, so what it needs is "which sums are three or
// four steps from here" — one pass, rather than one pass per candidate it might have
// picked.
export function parTable(dial: DialSpec, grid: Grid): readonly number[] {
  const INF = Number.POSITIVE_INFINITY
  let dp = new Array<number>(dial.maxSum + 1).fill(INF)
  dp[0] = 0
  for (let i = 0; i < cellCount(dial); i++) {
    const w = weightAt(dial, i)
    const a = grid[i] ?? 0
    const next = new Array<number>(dial.maxSum + 1).fill(INF)
    for (let s = 0; s <= dial.maxSum; s++) {
      const cur = dp[s] ?? INF
      if (cur === INF) continue
      for (let f = 0; f < dial.digits; f++) {
        const ns = s + w * f
        if (ns > dial.maxSum) break
        const cost = cur + stepCost(dial.digits, a, f)
        if (cost < (next[ns] ?? INF)) next[ns] = cost
      }
    }
    dp = next
  }
  return dp
}

// Minimum total steps from this position to `target`, or 0 for a target no arrangement
// reaches — which is what an out-of-range one answers too.
//
// Reads the table above rather than running a DP of its own, which costs nothing: the
// pass already allocates one array per key of this length, and one more return value is
// not another.
export function computePar(dial: DialSpec, grid: Grid, target: number): number {
  if (target < 0 || target > dial.maxSum) return 0
  const par = parTable(dial, grid)[target]
  return par !== undefined && Number.isFinite(par) ? par : 0
}

// Which way a key is moved. Up is a tap — the dial wraps round at the top — and down is
// a swipe down; the two are the same cost per step, so the route names whichever is
// shorter.
export type MoveDirection = 'up' | 'down'

// A jump straight to an end of the key's range: swipe left for the floor, right for the
// ceiling. Taken first when present, and worth one step however far it travels — which
// is why a key far from where it needs to be is often cheaper to reset than to walk.
export type MoveJump = 'zero' | 'nine'

// One instruction in an optimal route: the gesture, how many of it, and on which key.
//
// `steps` is the cost the score is measured against, so it counts the jump as the one
// step it is: a ceiling jump plus two downs is three steps, not two.
export type RouteStep = {
  weight: number
  jump: MoveJump | null
  moves: number
  direction: MoveDirection
  steps: number
}

// The cheapest way to move one key from `from` to `to`, as gestures rather than a
// count. Same four routes `stepCost` prices — walk up, walk down, reset to the floor and
// walk up, jump to the ceiling and walk down — and a test pins the two to the same
// total, so a hint can never describe a route that costs more than the par it is shown
// beside.
//
// Ties go to the earliest candidate, which orders them simplest-first: walking beats
// jumping when both cost the same, because one gesture is easier to follow than two.
export function movePlan(
  digits: number,
  from: number,
  to: number,
): Omit<RouteStep, 'weight'> {
  const top = digits - 1
  const up = (to - from + digits) % digits
  const down = (from - to + digits) % digits
  // Walking up is the seed rather than one of the candidates, so the reduce has an
  // initial value and the tie order still runs simplest-first: a walk only loses to a
  // jump that is strictly cheaper.
  const walkUp: Omit<RouteStep, 'weight'> = {
    jump: null,
    moves: up,
    direction: 'up',
    steps: up,
  }
  const candidates: Omit<RouteStep, 'weight'>[] = [
    { jump: null, moves: down, direction: 'down', steps: down },
    { jump: 'zero', moves: to, direction: 'up', steps: 1 + to },
    { jump: 'nine', moves: top - to, direction: 'down', steps: 1 + (top - to) },
  ]
  return candidates.reduce(
    (best, next) => (next.steps < best.steps ? next : best),
    walkUp,
  )
}

// One layer of the DP: the cheapest way to reach each running sum once this key has been
// decided, and the value it was set to in order to get there. -1 marks a sum this key
// could not produce.
type Layer = { costs: number[]; choice: number[] }

const INF = Number.POSITIVE_INFINITY

function extendLayer(
  dial: DialSpec,
  costs: number[],
  weight: number,
  from: number,
): Layer {
  const next = new Array<number>(dial.maxSum + 1).fill(INF)
  const choice = new Array<number>(dial.maxSum + 1).fill(-1)
  for (let s = 0; s <= dial.maxSum; s++) {
    const cur = costs[s] ?? INF
    if (cur === INF) continue
    for (let f = 0; f < dial.digits; f++) {
      const sum = s + weight * f
      if (sum > dial.maxSum) break
      const cost = cur + stepCost(dial.digits, from, f)
      if (cost < (next[sum] ?? INF)) {
        next[sum] = cost
        choice[sum] = f
      }
    }
  }
  return { costs: next, choice }
}

// One key's share of an optimal route: which key to move, where it stands and where it
// has to end up, and the cheapest gesture for getting it there.
//
// Where `RouteStep` is keyed by weight, this is keyed by key index. The two are
// different questions: printing a route as instructions wants the weight, because a step
// on either key of a pair moves the sum by the same amount — but pointing at a button to
// press wants the button, and the tutorial has to point.
export type KeyStep = Omit<RouteStep, 'weight'> & {
  index: number
  from: number
  to: number
  weight: number
}

// Walks the layers back from the target, collecting what each key is owed.
//
// Keys already at the right value contribute nothing, and drop out. `null` is a target
// this position cannot reach at all, which is what the callers turn into an empty route
// rather than a route to nowhere.
function readKeyPlan(
  dial: DialSpec,
  grid: Grid,
  layers: Layer[],
  target: number,
): KeyStep[] | null {
  const plan: KeyStep[] = []
  let sum = target
  for (let i = cellCount(dial) - 1; i >= 0; i--) {
    const value = layers[i]?.choice[sum] ?? -1
    if (value < 0) return null
    const weight = weightAt(dial, i)
    const from = grid[i] ?? 0
    const move = movePlan(dial.digits, from, value)
    if (move.steps > 0) plan.push({ index: i, from, to: value, weight, ...move })
    sum -= weight * value
  }
  return plan
}

// The same walk, keyed by weight — see `readKeyPlan` for why there are two.
function readRoute(
  dial: DialSpec,
  grid: Grid,
  layers: Layer[],
  target: number,
): RouteStep[] {
  const plan = readKeyPlan(dial, grid, layers, target)
  if (plan === null) return []
  return plan.map(({ index: _index, from: _from, to: _to, ...step }) => step)
}

// Two keys of the same weight move the sum by the same amount, so asking for one step
// on each and two on either are the same instruction — and printed apart they read as
// two, which is what "1× ② › 1× ②" was.
//
// Only plain walks combine. A jump is a gesture aimed at one key's own position, so two
// of them are genuinely two things to do and stay apart, as do a walk up and a walk
// down: merging those would name a direction that undoes half of itself.
const merged = (route: readonly RouteStep[]): RouteStep[] => {
  const byKey = new Map<string, RouteStep>()
  const out: RouteStep[] = []
  for (const step of route) {
    if (step.jump !== null) {
      out.push(step)
      continue
    }
    const key = `${step.weight}:${step.direction}`
    const held = byKey.get(key)
    if (held === undefined) {
      const copy = { ...step }
      byKey.set(key, copy)
      out.push(copy)
      continue
    }
    held.moves += step.moves
    held.steps += step.steps
  }
  return out
}

// The DP laid out one key at a time, so a route can be walked back out of it.
//
// Coarsest weight last, matching the order a position is stored in; the walk back comes
// out coarsest-first, which is how the game is taught — get near the target with the
// heavy keys, then trim with the fine ones.
function planLayers(dial: DialSpec, grid: Grid): Layer[] {
  const start = new Array<number>(dial.maxSum + 1).fill(INF)
  start[0] = 0
  const layers: Layer[] = []
  let costs = start
  for (let i = 0; i < cellCount(dial); i++) {
    const layer = extendLayer(dial, costs, weightAt(dial, i), grid[i] ?? 0)
    layers.push(layer)
    costs = layer.costs
  }
  return layers
}

// Whether the last layer can reach the target at all.
const reaches = (dial: DialSpec, layers: Layer[], target: number): boolean =>
  Number.isFinite(layers[cellCount(dial) - 1]?.costs[target] ?? INF)

// The route behind computePar — not just what the best solution costs but what it is.
export function computeRoute(dial: DialSpec, grid: Grid, target: number): RouteStep[] {
  if (target < 0 || target > dial.maxSum) return []
  const layers = planLayers(dial, grid)
  if (!reaches(dial, layers, target)) return []
  return merged(readRoute(dial, grid, layers, target)).sort((a, b) => b.weight - a.weight)
}

// The same optimal route as a list of keys to move, coarsest first — the order the game
// is taught in, and the order the tutorial walks a player through.
//
// Unmerged, because merging is what makes a route readable and what makes it
// unpointable: "2× ③" is one instruction and two keys. The tutorial lights one key at a
// time, so it needs them apart.
export function computeKeyPlan(dial: DialSpec, grid: Grid, target: number): KeyStep[] {
  if (target < 0 || target > dial.maxSum) return []
  const layers = planLayers(dial, grid)
  if (!reaches(dial, layers, target)) return []
  const plan = readKeyPlan(dial, grid, layers, target)
  // Sorted by weight alone, on a walk that already ran coarsest key first: the sort is
  // stable, so two keys of the same weight keep that order rather than swapping.
  return plan === null ? [] : [...plan].sort((a, b) => b.weight - a.weight)
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

// Trainee celebrates the hit rather than the run, and only the route earns it: the
// hit has to have been taken in optimal steps. Being quick is not celebrated on its
// own — Trainee has no timer worth racing, and cheering a fast hit that wasted moves
// taught the opposite of what the mode is for. A quick, wasteful hit now gets the
// coach's debrief instead, which is the thing a learner can act on.
//
// Optimal means exactly optimal, not nearly: `accuracyFactor` returns 1 only when no
// step was wasted, and softening that would celebrate a near miss.
const CLEAN_SPEED = 0.6

type Factors = { accFactor: number; spdFactor: number }

export const isCleanHit = (hit: Factors): boolean => hit.accFactor === 1

// What a batch earned its celebration for, so the praise can name it. Speed is not a
// reason of its own, but it still colours one: a hit that was optimal *and* quick is a
// bigger thing than one that was merely optimal, and says so.
//
// A batch is every target one press cleared, so it can manage both across two hits
// without either hit managing both — which still deserves the both-line.
export type CleanReason = 'accuracy' | 'both'

export function cleanHitReason(hits: readonly Factors[]): CleanReason | null {
  const accurate = hits.some(isCleanHit)
  if (!accurate) return null
  return hits.some((hit) => hit.spdFactor >= CLEAN_SPEED) ? 'both' : 'accuracy'
}

// Points for a single hit, blending accuracy and speed per the mode's weights.
export function computeHitPoints(opts: {
  par: number
  userSteps: number
  timeLeft: number
  duration: number
  weights: { acc: number; spd: number }
  // What a perfect hit is worth before the blend. The mode's own figure — see
  // `ScoringRules` — rather than a constant in here, because it is a rule a mode is
  // allowed to change.
  base: number
}): number {
  const { par, userSteps, timeLeft, duration, weights, base } = opts
  const acc = accuracyFactor(par, userSteps)
  const spd = speedReward(speedFactor(timeLeft, duration))
  return Math.round(base * (weights.acc * acc + weights.spd * spd))
}

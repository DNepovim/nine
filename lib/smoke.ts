// The hero's smoke: what the torch leaves behind it, as one tapering ribbon.
//
// The whole effect rests on a single piece of physics, and it is the reason none of this
// needs to know which way the hero is facing. **Smoke is laid into still air at the world
// position that made it, and then it only spreads and fades.** Stand still and every sample
// lands on the last one, so there is a curl at the wick and nothing else. Walk, and the hero
// walks out from under its own smoke — which is exactly what the eye reads as wind blowing
// into the flame. Nobody computes a wind; there isn't one.
//
// The second piece is what a plan view does to smoke made at a standstill: it goes *up*,
// away from the eye, so there is almost nothing to see and it is gone in under half a
// second. Smoke made under way is laid out flat across the sheet instead, where its whole
// length is on show and worth keeping for three times as long. So how fast the hero was
// going when a sample was laid is what decides both how wide that sample ever gets and how
// long it lasts — one number, doing all the work that a wind model would have done.
//
// A ring buffer rather than a list: this is rebuilt and redrawn on the UI thread every
// frame, and a buffer that never allocates is a buffer that never makes work for the
// collector mid-run.
//
// Above its callers, not below — see the note in `lib/flame.ts`.

// How many samples the ribbon holds, and how often one is laid. Together they are a little
// over the longest a sample can live, so the ring never writes over one that is still
// showing.
const SAMPLES = 40
export const LAY_MS = 30

// How long a sample lasts: the first number standing still, the second added at full speed.
const LIFE_STILL = 420
const LIFE_SPAN = 680

// How wide a sample is, as a fraction of the flame: where it starts, how much it grows by
// standing still, and how much more at full speed.
const SEED = 0.16
const GROW_STILL = 0.22
const GROW_SPAN = 1.35

// The slow curl every sample drifts on, so a ribbon is never a ruled band. Per millisecond
// and as a fraction of the flame.
const CURL_STILL = 0.00018
const CURL_SPAN = 0.0004
const CURL_MS = 500
// How far apart two neighbouring slots sit in the curl. Small, so the curl runs *along* the
// ribbon as a wave rather than throwing neighbours opposite ways.
const CURL_STEP = 0.55

// How far a sample laid standing still lands from the wick, as a fraction of the flame.
// Standing, every sample would otherwise land on the last one, and a ribbon threaded through
// one point has no width at all — the smoke would vanish exactly when the hero stopped.
// Scattered instead, the pile reads as what it is: a small curl sitting on the fire. The step
// is the golden angle, so a run of samples goes round rather than back and forth, and it is
// scaled away entirely by the time the hero is walking.
const SCATTER = 0.5
const SCATTER_STEP = 2.39996

// The least a ribbon can be drawn from. Two samples have no shape to speak of.
const LEAST = 3

export type Trail = {
  x: number[]
  y: number[]
  // When each sample was laid, and how fast the hero was going at the time — nought to one,
  // where one is a walk. `born` of less than nought is a slot nothing has been laid in yet.
  born: number[]
  speed: number[]
  driftX: number[]
  driftY: number[]
  // The slot the newest sample is in.
  head: number
}

export function createTrail(): Trail {
  return {
    x: Array.from({ length: SAMPLES }, () => 0),
    y: Array.from({ length: SAMPLES }, () => 0),
    born: Array.from({ length: SAMPLES }, () => -1),
    speed: Array.from({ length: SAMPLES }, () => 0),
    driftX: Array.from({ length: SAMPLES }, () => 0),
    driftY: Array.from({ length: SAMPLES }, () => 0),
    head: SAMPLES - 1,
  }
}

// How long a sample laid at this speed has.
export function smokeLife(speed: number): number {
  'worklet'
  return LIFE_STILL + LIFE_SPAN * Math.min(1, Math.max(0, speed))
}

// Lay one sample at a world position. `speed` is nought standing still and one at a walk,
// and `size` is the flame's own radius, which is what the scatter is measured in.
export function layTrail(
  trail: Trail,
  x: number,
  y: number,
  speed: number,
  nowMs: number,
  size: number,
): void {
  'worklet'
  const at = (trail.head + 1) % SAMPLES
  const held = Math.min(1, Math.max(0, speed))
  const scatter = size * SCATTER * (1 - held)
  const spin = at * SCATTER_STEP
  trail.head = at
  trail.x[at] = x + Math.cos(spin) * scatter
  trail.y[at] = y + Math.sin(spin) * scatter
  trail.born[at] = nowMs
  trail.speed[at] = held
  trail.driftX[at] = 0
  trail.driftY[at] = 0
}

// Move every sample along its own curl. `size` is the flame's own radius, which is what the
// drift is measured in — the smoke of a bigger fire wanders further.
export function driftTrail(
  trail: Trail,
  dtMs: number,
  nowMs: number,
  size: number,
): void {
  'worklet'
  for (let i = 0; i < SAMPLES; i++) {
    if ((trail.born[i] ?? -1) < 0) continue
    const curl = size * (CURL_STILL + CURL_SPAN * (trail.speed[i] ?? 0)) * dtMs
    const phase = nowMs / CURL_MS + i * CURL_STEP
    trail.driftX[i] = (trail.driftX[i] ?? 0) + Math.sin(phase) * curl
    trail.driftY[i] = (trail.driftY[i] ?? 0) + Math.cos(phase) * curl
  }
}

function easeOut(t: number): number {
  'worklet'
  return 1 - (1 - t) * (1 - t) * (1 - t)
}

// The ribbon as one closed path, drawn relative to (`originX`, `originY`) — the hero, whose
// box it is painted in. One polygon rather than a quad per sample: a run of quads has a seam
// at every join, and a seam in something this faint is the one thing that would give the
// whole effect away.
export function ribbonPath(
  trail: Trail,
  nowMs: number,
  size: number,
  originX: number,
  originY: number,
): string {
  'worklet'
  const px: number[] = []
  const py: number[] = []
  const half: number[] = []

  // Newest first. Samples were laid in order, so ages only climb going back — the first dead
  // one is the end of the ribbon.
  for (let k = 0; k < SAMPLES; k++) {
    const i = (trail.head - k + SAMPLES) % SAMPLES
    const born = trail.born[i] ?? -1
    if (born < 0) break
    const age = (nowMs - born) / smokeLife(trail.speed[i] ?? 0)
    if (age < 0 || age > 1) break
    const speed = trail.speed[i] ?? 0
    px.push((trail.x[i] ?? 0) + (trail.driftX[i] ?? 0) - originX)
    py.push((trail.y[i] ?? 0) + (trail.driftY[i] ?? 0) - originY)
    half.push(size * (SEED + (GROW_STILL + GROW_SPAN * speed) * easeOut(age)))
  }

  if (px.length < LEAST) return ''

  const left: string[] = []
  const right: string[] = []
  // Two samples laid on the same spot have no direction between them. The one before still
  // does, so the normal is carried forward rather than guessed at — which also gives the
  // first sample of all something to start from.
  let nx = 0
  let ny = 1
  for (let i = 0; i < px.length; i++) {
    const ax = px[Math.max(0, i - 1)] ?? 0
    const ay = py[Math.max(0, i - 1)] ?? 0
    const bx = px[Math.min(px.length - 1, i + 1)] ?? 0
    const by = py[Math.min(px.length - 1, i + 1)] ?? 0
    const run = Math.hypot(bx - ax, by - ay)
    if (run > 0) {
      nx = -(by - ay) / run
      ny = (bx - ax) / run
    }
    const w = half[i] ?? 0
    const x = px[i] ?? 0
    const y = py[i] ?? 0
    left.push(
      `${Math.round((x + nx * w) * 10) / 10} ${Math.round((y + ny * w) * 10) / 10}`,
    )
    right.push(
      `${Math.round((x - nx * w) * 10) / 10} ${Math.round((y - ny * w) * 10) / 10}`,
    )
  }

  // Down one side and back up the other, which is what makes the two edges one shape.
  let d = `M${left.join('L')}`
  for (let i = right.length - 1; i >= 0; i--) d += `L${right[i] ?? ''}`
  return `${d}Z`
}

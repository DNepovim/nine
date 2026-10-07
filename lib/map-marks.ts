import type { Bump, LandFeature, Peak, Tree } from '@/machines/arcade-land'

// The hand. One feature in, SVG path strings out.
//
// Two paths per mark, never more: a closed `body` that is filled with the surface colour
// before it is inked — which is what makes a mark knock out whatever stands behind it — and
// an open `detail` of hachures, shading and trunks that is only stroked.
//
// Positions come in as pitches and go out as points in the mark's own box, so a feature is
// one small `<Svg>` the camera can move rather than a slice of one enormous one.

type Mark = { body: string; detail: string }

export type Drawn = {
  // Where the box sits, in points relative to the feature's own position in the world.
  left: number
  top: number
  width: number
  height: number
  // Where the feature stands, in its own box: the middle of the ground its elements stand
  // on. The sheet can be turned, and a feature drawn in profile is turned back out of that
  // turn about this point — see components/game/land-mark.tsx. Everything the land was
  // generated against was measured from the ground its elements stand on, so this is the
  // point of it that a turn may not move.
  foot: { x: number; y: number }
  // Back to front. Each one is filled and then inked before the next is begun, which is the
  // whole of how the occlusion works.
  marks: readonly Mark[]
}

// Room round a feature for the parts that reach past its elements: a spire, an antler of
// hachure, the swell of a canopy.
const PAD = 14

const n = (v: number): string => (Math.round(v * 10) / 10).toString()
const move = (x: number, y: number): string => `M${n(x)} ${n(y)}`
const line = (x: number, y: number): string => `L${n(x)} ${n(y)}`
const quad = (cx: number, cy: number, x: number, y: number): string =>
  `Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`

// A small deterministic wobble, so no two marks of a kind are the same line twice. Seeded
// from the element, so it is the same wobble every frame — a line that jittered per render
// would shimmer.
//
// Exported because the siege is drawn by the same hand — see lib/siege-marks.ts. One
// generator for the whole sheet, so a besieged wall wavers the way a mountain range does.
export function wobble(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296 - 0.5
  }
}

// ── mountains ───────────────────────────────────────────────────────────────

function peakMark(p: Peak, pitch: number, ox: number, oy: number): Mark {
  const rnd = wobble(p.seed)
  const x = p.x * pitch - ox
  const y = p.y * pitch - oy
  const h = p.height * pitch
  const w = p.width * pitch
  const side = p.flip ? -1 : 1

  let body = move(x - w, y)
  if (p.form === 'crag') {
    body += line(x - w * 0.52 + rnd() * 4, y - h * 0.52)
    body += line(x - w * 0.2 + rnd() * 2, y - h * 0.74)
    body += line(x + rnd() * 3, y - h)
    body += line(x + w * 0.34 + rnd() * 2, y - h * 0.6)
    body += line(x + w * 0.66 + rnd() * 4, y - h * 0.44)
    body += line(x + w, y)
  } else if (p.form === 'flat') {
    body += line(x - w * 0.46 + rnd() * 3, y - h * 0.9)
    body += line(x - w * 0.3, y - h)
    body += line(x + w * 0.3 + rnd() * 3, y - h)
    body += line(x + w * 0.5, y - h * 0.86)
    body += line(x + w, y)
  } else {
    body += quad(x - w * 0.45 + rnd() * 4, y - h * 0.6, x + rnd() * 3, y - h)
    body += quad(x + w * 0.45 + rnd() * 4, y - h * 0.55, x + w, y)
  }
  body += 'Z'

  let detail = ''
  // A snow break near the summit, on the tall ones that are not flat-topped.
  if (h > pitch * 0.15 && p.form !== 'flat') {
    detail += `${move(x - w * 0.3, y - h * 0.62)}${line(x + rnd() * 2, y - h * 0.8)}${line(x + w * 0.28, y - h * 0.6)}`
  }
  // Hachures down whichever flank this range has in shade.
  const lines = 4 + Math.floor((rnd() + 0.5) * 4)
  for (let i = 1; i <= lines; i++) {
    const k = i / (lines + 1)
    const sx = x + w * side * k + rnd() * 2
    const sy = y - h * (1 - k) + rnd() * 2
    const len = h * (0.34 - k * 0.19) + 2
    detail += `${move(sx, sy)}${line(sx + len * 0.42 * side, sy + len)}`
  }
  return { body, detail }
}

// ── hills ───────────────────────────────────────────────────────────────────

function bumpMark(b: Bump, pitch: number, ox: number, oy: number): Mark {
  const rnd = wobble(b.seed)
  const x = b.x * pitch - ox
  const y = b.y * pitch - oy
  const w = b.width * pitch
  const body = `${move(x - w, y)}${quad(x + rnd() * 4, y - w * 1.3, x + w, y)}Z`
  const detail =
    b.form === 'hummock'
      ? `${move(x - w * 0.52, y)}${quad(x - w * 0.1, y - w * 0.8, x + w * 0.42, y)}`
      : `${move(x + w * 0.2, y - w * 0.52)}${line(x + w * 0.56, y - w * 0.08)}`
  return { body, detail }
}

// ── trees ───────────────────────────────────────────────────────────────────
//
// A wood is one mark rather than one per tree. Within a wood the canopies are inked flat
// over each other, which is how a mass of trees is drawn anyway — and it is the difference
// between a forest costing two paths and costing four hundred.

function treeBody(t: Tree, pitch: number, ox: number, oy: number): string {
  const rnd = wobble(t.seed)
  const x = t.x * pitch - ox
  const y = t.y * pitch - oy
  const r = t.radius * pitch

  if (t.form === 'fir' || t.form === 'spruce') {
    const tiers = t.form === 'fir' ? 3 : 4
    const narrow = t.form === 'fir' ? 1 : 0.78
    const top = r * (t.form === 'fir' ? 2.5 : 2.9)
    let d = move(x, y - top)
    for (let k = tiers - 1; k >= 0; k--) {
      const yy = y - r * (0.35 + k * (top / r / tiers) * 0.95)
      const ww = r * narrow * (1.05 - k * (0.26 / (tiers / 3)))
      d += line(x - ww * 0.55, yy - r * 0.2) + line(x - ww, yy)
    }
    d += line(x, y - r * 0.1)
    for (let k = 0; k < tiers; k++) {
      const yy = y - r * (0.35 + k * (top / r / tiers) * 0.95)
      const ww = r * narrow * (1.05 - k * (0.26 / (tiers / 3)))
      d += line(x + ww, yy) + line(x + ww * 0.55, yy - r * 0.2)
    }
    return `${d}Z`
  }

  if (t.form === 'bare') return ''

  if (t.form === 'round') {
    // A circle, as four quadrant curves — a canopy with no lobes at all.
    const cy = y - r * 1.15
    const k = r * 0.55
    return (
      move(x - r, cy) +
      `C${n(x - r)} ${n(cy - k)} ${n(x - k)} ${n(cy - r)} ${n(x)} ${n(cy - r)}` +
      `C${n(x + k)} ${n(cy - r)} ${n(x + r)} ${n(cy - k)} ${n(x + r)} ${n(cy)}` +
      `C${n(x + r)} ${n(cy + k)} ${n(x + k)} ${n(cy + r)} ${n(x)} ${n(cy + r)}` +
      `C${n(x - k)} ${n(cy + r)} ${n(x - r)} ${n(cy + k)} ${n(x - r)} ${n(cy)}Z`
    )
  }

  // lobed: the default broadleaf, a canopy of seven lumps
  let d = ''
  const lobes = 7
  for (let i = 0; i <= lobes; i++) {
    const a = Math.PI * (1 + i / lobes)
    const rr = r * (1 + rnd() * 0.24)
    const px = x + Math.cos(a) * rr
    const py = y - r * 1.05 + Math.sin(a) * rr * 0.95
    d += i === 0 ? move(px, py) : line(px, py)
  }
  return `${d}Z`
}

function treeDetail(t: Tree, pitch: number, ox: number, oy: number): string {
  const rnd = wobble(t.seed + 7)
  const x = t.x * pitch - ox
  const y = t.y * pitch - oy
  const r = t.radius * pitch

  if (t.form === 'bare') {
    // Winter, or a dead stand: no canopy, five branches off one trunk.
    let d = `${move(x, y)}${line(x, y - r * 2.1)}`
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + rnd() * 2.2
      const from = r * (1.1 + (rnd() + 0.5) * 0.8)
      d += `${move(x, y - from)}${line(x + Math.cos(a) * r * 0.95, y - from + Math.sin(a) * r * 0.75)}`
    }
    return d
  }

  let d = `${move(x, y)}${line(x, y - r * 1.1)}`
  if (t.form === 'round') {
    // Two arcs of shade inside, which is how a round canopy is drawn.
    const cy = y - r * 1.15
    for (let k = 1; k <= 2; k++) {
      const rr = r * (1 - k * 0.3)
      d += `${move(x - rr * 0.8, cy + rr * 0.4)}${quad(x, cy + rr * 1.1, x + rr * 0.8, cy + rr * 0.4)}`
    }
  }
  return d
}

// ── a feature ───────────────────────────────────────────────────────────────

const bounds = (feature: LandFeature, pitch: number) => {
  const xs: number[] = []
  const ys: number[] = []
  const add = (x: number, y: number, reach: number, up: number) => {
    xs.push(x * pitch - reach, x * pitch + reach)
    ys.push(y * pitch - up, y * pitch + reach)
  }
  for (const p of feature.peaks) add(p.x, p.y, p.width * pitch, p.height * pitch)
  for (const b of feature.bumps) add(b.x, b.y, b.width * pitch, b.width * pitch * 1.3)
  for (const t of feature.trees) add(t.x, t.y, t.radius * pitch, t.radius * pitch * 3)
  return {
    left: Math.min(...xs) - PAD,
    top: Math.min(...ys) - PAD,
    right: Math.max(...xs) + PAD,
    bottom: Math.max(...ys) + PAD,
  }
}

// Where a feature stands: the middle of its elements' own footings, which for a range is the
// middle of the range and for a wood the middle of the stand. Not the middle of the box — the
// box is as tall as the tallest thing in it, and a mountain's summit is not where it stands.
function footOf(feature: LandFeature, pitch: number, ox: number, oy: number) {
  const feet = [...feature.peaks, ...feature.bumps, ...feature.trees]
  const sum = feet.reduce((at, one) => ({ x: at.x + one.x, y: at.y + one.y }), {
    x: 0,
    y: 0,
  })
  return {
    x: (sum.x / feet.length) * pitch - ox,
    y: (sum.y / feet.length) * pitch - oy,
  }
}

// One feature, drawn: its box and its marks, back to front.
export function drawFeature(feature: LandFeature, pitch: number): Drawn {
  const box = bounds(feature, pitch)
  const ox = box.left
  const oy = box.top

  const marks: Mark[] = []
  if (feature.kind === 'ridge') {
    for (const p of feature.peaks) marks.push(peakMark(p, pitch, ox, oy))
  } else if (feature.kind === 'hills') {
    for (const b of feature.bumps) marks.push(bumpMark(b, pitch, ox, oy))
  } else {
    // The whole wood as one mark: bodies in one path, trunks and shading in the other.
    let body = ''
    let detail = ''
    for (const t of feature.trees) {
      body += treeBody(t, pitch, ox, oy)
      detail += treeDetail(t, pitch, ox, oy)
    }
    marks.push({ body, detail })
  }

  return {
    left: ox,
    top: oy,
    width: Math.max(1, box.right - box.left),
    height: Math.max(1, box.bottom - box.top),
    foot: footOf(feature, pitch, ox, oy),
    marks,
  }
}

// Two hex colours, mixed.
//
// A worklet as well as a plain function, which is why it is here rather than inside
// either of the two components that reach for it: the NINE title mixes on the UI thread,
// a frame at a time, while the challenge card's flip clock mixes once per render to cut
// one gradient into the slices its flaps show. Same arithmetic, so one copy.
//
// Channel-wise on the sRGB values, with no gamma correction. That is the wrong way to mix
// light and the right way to mix *these*: every pair handed to it is two stops of one
// gradient a designer picked by eye, and the midpoint wanted is the one the eye expects
// between them rather than the one a photometer would measure.
export function mixHex(a: string, b: string, t: number): string {
  'worklet'
  if (t <= 0) return a
  if (t >= 1) return b
  const r1 = parseInt(a.slice(1, 3), 16)
  const g1 = parseInt(a.slice(3, 5), 16)
  const b1 = parseInt(a.slice(5, 7), 16)
  const r2 = parseInt(b.slice(1, 3), 16)
  const g2 = parseInt(b.slice(3, 5), 16)
  const b2 = parseInt(b.slice(5, 7), 16)
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${hex(r1 + (r2 - r1) * t)}${hex(g1 + (g2 - g1) * t)}${hex(b1 + (b2 - b1) * t)}`
}

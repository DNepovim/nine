// What the player draws on a drafting board's targets area: tap a place, tap another, and a
// line segment is ruled between them, its ends named A and B. The next goes on from C, and
// there is room for five: a sixth rubs out the first, and goes on in the alphabet from where the
// last left off. Pure state — where a segment is drawn is `DraftedSegments`' business.

// How many segments the board holds at once.
export const MAX_SEGMENTS = 5

export type SegmentPoint = { x: number; y: number }

// `at` is which segment this was to be ruled, from nought: it is what names its ends, and it
// stays with the segment when older ones are rubbed out, so a letter never changes.
type Segment = { from: SegmentPoint; to: SegmentPoint; at: number }

export type Drawing = {
  segments: readonly Segment[]
  // How many segments have been ruled in all, rubbed-out ones included — the `at` of the next.
  made: number
  // The first tap of a segment, waiting for its second. Null between segments.
  pending: SegmentPoint | null
}

export const EMPTY_DRAWING: Drawing = { segments: [], made: 0, pending: null }

// The drawing after a tap at `point`: the first tap of a segment is kept, the second closes it.
export function plotPoint(drawing: Drawing, point: SegmentPoint): Drawing {
  if (drawing.pending === null) return { ...drawing, pending: point }
  const ruled = [
    ...drawing.segments,
    { from: drawing.pending, to: point, at: drawing.made },
  ]
  return {
    // The oldest goes when there is no room for the new one.
    segments: ruled.slice(-MAX_SEGMENTS),
    made: drawing.made + 1,
    pending: null,
  }
}

// The drawing with a half-made segment taken back — what pressing a key does. Segments already
// ruled stay; the one that was waiting for its second end is gone.
export const dropPending = (drawing: Drawing): Drawing =>
  drawing.pending === null ? drawing : { ...drawing, pending: null }

// The name of the `index`-th point, counting from nought: A, B, C … The two ends of segment `n`
// are points `2n` and `2n + 1`, so the first is A–B and the fifth I–J. After Z it begins again.
export const pointName = (index: number): string => String.fromCharCode(65 + (index % 26))

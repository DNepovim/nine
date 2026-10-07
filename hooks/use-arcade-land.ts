import { useRef } from 'react'

import { tiltedWindow } from '@/lib/arcade-tilt'
import {
  featureIn,
  featuresIn,
  type Blocked,
  type LandFeature,
} from '@/machines/arcade-land'
import type { RegionKey } from '@/machines/arcade-regions'

// The land in sight, kept.
//
// The country itself is free — `featureIn` is a pure function of a cell and the run's seed,
// so nothing has to be stored. What is kept is the *answer*, for two reasons: generating a
// cell twice a frame would be wasteful, and a cell asked again later would be asked with
// more ways in the way, which would change the land behind the player as they walked.
//
// Cleared when the seed changes, because that is a different world, or when the pitch does,
// because that is the same world at a different size.

// How far past the canvas the land is drawn. A margin, so a feature is already there when
// the camera drifts onto it rather than appearing at the edge of the screen.
const MARGIN = 0.6

// What the land must keep clear of. The way is the one thing on this screen the player has
// to be able to read, so terrain is what yields.
const WAY_ZONE = 0.22
// A settlement: the disc, the mark under it and the name under that.
const PLACE_ZONE = 0.3

export type LandSight = {
  // Each way in sight, as the two crossroads it joins. Sampled as a straight line rather
  // than as the curve it is drawn as: the curve bows by less than the zone absorbs, and this
  // is a keep-out test rather than a drawing.
  ways: readonly { ax: number; ay: number; bx: number; by: number }[]
  places: readonly { x: number; y: number }[]
}

export function useArcadeLand({
  seed,
  pitch,
  canvas,
  origin,
  sight,
}: {
  seed: number
  pitch: number
  canvas: { width: number; height: number }
  // The crossroad the hero is on, in pitches — the middle of the window.
  origin: { x: number; y: number }
  sight: LandSight
}): readonly LandFeature[] {
  const cache = useRef(new Map<string, LandFeature | null>())
  const built = useRef({ seed: -1, pitch: -1 })

  if (built.current.seed !== seed || built.current.pitch !== pitch) {
    cache.current.clear()
    built.current = { seed, pitch }
  }

  if (pitch <= 0 || canvas.width <= 0) return []

  const blocked: Blocked = (x, y, radius) => {
    for (const place of sight.places) {
      if (Math.hypot(place.x - x, place.y - y) < PLACE_ZONE + radius) return true
    }
    for (const way of sight.ways) {
      // The nearest point on the segment, which is all a keep-out test needs to know.
      const dx = way.bx - way.ax
      const dy = way.by - way.ay
      const len = dx * dx + dy * dy
      const t =
        len === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - way.ax) * dx + (y - way.ay) * dy) / len))
      const nx = way.ax + dx * t
      const ny = way.ay + dy * t
      if (Math.hypot(nx - x, ny - y) < WAY_ZONE + radius) return true
    }
    return false
  }

  // What the canvas sees, which is not what it measures: the sheet lies away from the
  // reader, so the top edge of it is country well past where a flat sheet would have put
  // it, and the bottom edge is country nearer than that. Asked of the tilt rather than
  // worked out here — see lib/arcade-tilt.ts.
  const seen = tiltedWindow(canvas)
  const halfWide = seen.wide / pitch + MARGIN

  return featuresIn(
    {
      left: origin.x - halfWide,
      right: origin.x + halfWide,
      top: origin.y - seen.up / pitch - MARGIN,
      bottom: origin.y + seen.down / pitch + MARGIN,
    },
    (region: RegionKey, gx: number, gy: number) => {
      const key = `${region}:${gx}:${gy}`
      const known = cache.current.get(key)
      if (known !== undefined) return known
      const grown = featureIn(region, gx, gy, seed, blocked)
      cache.current.set(key, grown)
      return grown
    },
  )
}

import type { CSSProperties } from 'react'

// The web half of `TurningEdge` — see the native file for what the edge is and why it
// turns. Here nothing turns: the box stays still and the gradient's own angle moves,
// animated by CSS (`.turning-edge` in `global.css`).
//
// The native half rotates a square as wide as the box's diagonal and leans on the
// parent's clip to hide the corners. In a browser that clip does not hold: a rotating
// child is promoted to its own compositing layer, and on iOS Safari a promoted layer is
// no longer cut by an ancestor's `overflow: hidden` + `border-radius`, so the whole
// square flashed across the screen whenever the compositor chose to promote it. Forcing
// the parent onto a layer of its own (`isolate`, `backfaceVisibility`) did not stop it.
// A gradient whose angle moves inside a box that does not has nothing to escape.
//
// A plain `div` because the colours reach the stylesheet as custom properties, which
// React Native Web's style handling does not pass through.
export function TurningEdge({
  edge,
}: {
  edge: readonly [string, string]
  // Wanted only by the native half, which has to size its square off them.
  width: number
  height: number
}) {
  return (
    <div
      aria-hidden
      className="turning-edge"
      style={{ '--edge-from': edge[0], '--edge-to': edge[1] } as CSSProperties}
    />
  )
}

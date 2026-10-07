import { ANCHOR } from '@/constants/arcade'

// The sheet, lying away from the reader.
//
// The map used to be read flat on: a crossroad two pitches up the sheet was drawn two
// pitches up the screen, at the size it would have had under the hero's own feet. That is
// what made it read as a diagram rather than as country — distance was something the player
// counted rather than something they saw.
//
// So the sheet is tilted. There is a horizon a fixed way above the row the hero stands on,
// and the sheet is projected onto the screen as a plane running out to it: what is further
// up is smaller, closer to its neighbours, and drawn nearer the middle. One number does all
// three, because in a perspective they are one fact — a mark drawn at half size stands half
// as far from the next mark and half as far off the centre line.
//
// Three decisions worth naming.
//
// A mark's depth is read off where it is *drawn*, in screen points, and never off where it
// sits on the sheet. The camera pans, zooms and turns under the reader, and the horizon
// belongs to the screen rather than to the map: whichever way the player has turned the
// sheet, what is at the top of it is what is far off. So this takes the whole camera and
// hands back a place on the sheet, which is the one frame every mark on it is placed in.
//
// Nothing is distorted, only placed and sized. A mountain is drawn at the size its own foot
// is owed and stands up straight, because the alternative is a tilted sheet with tilted
// mountains lying on it, which is not how a map has ever drawn one. A way is the exception
// that proves it: both of its ends are placed, so a way running up the sheet is drawn short
// and still meets the town at its tip.
//
// And a fight is flat. A siege is already a view of its own — a wall across the top of the
// canvas and the ground in front of it — so the sheet comes down to level as the camera
// closes on the walls, and comes back up when they are down. That is `tilt`.

// How far above the hero's own row the horizon stands, in canvas heights. The one knob, and
// smaller is a steeper sheet. At this figure the top of the canvas is a little under three
// pitches of country out and drawn at about three fifths size — depth a player reads at a
// glance, while a fan, which is never more than a pitch out, loses under a fifth and stays
// as answerable as it was.
const HORIZON = 1.8

// How small and how large a mark may be drawn, whatever the camera is doing. Neither is
// reached on a phone: they are here so that a point far off the top of the sheet cannot come
// back as a nought and one just under the reader cannot come back as a hundred.
const DEEPEST = 0.25
const NEAREST = 1.6

// The camera, as the one value a mark needs to know where it is drawn: the pan, the zoom,
// the turn, how much of the tilt is on, and where the horizon stands in points.
export type Sheet = {
  x: number
  y: number
  turn: number
  scale: number
  tilt: number
  horizon: number
}

// Where a mark is drawn and at what size.
export type Lie = { x: number; y: number; scale: number }

export const horizonOf = (canvasHeight: number): number => canvasHeight * HORIZON

// Where a point of the sheet is drawn, in the sheet's own coordinates, and the share of its
// own size it is drawn at.
//
// Handed back in sheet coordinates rather than in screen ones so that a mark can stay where
// it is laid out and carry the difference as a transform: the camera is still one pan on one
// view, and nothing in the screen's layout has to know the tilt exists.
export function tiltedAt(sheet: Sheet, x: number, y: number): Lie {
  'worklet'
  // Flat on, and nothing to work out, which is also the one answer a canvas that has not been
  // measured yet can be given: no horizon means no sheet to tilt.
  if (sheet.tilt === 0 || sheet.horizon <= 0) return { x, y, scale: 1 }
  // Where the point is drawn with the sheet flat: the pan under the zoom, then the turn.
  const px = (x + sheet.x) * sheet.scale
  const py = (y + sheet.y) * sheet.scale
  const cos = Math.cos(sheet.turn)
  const sin = Math.sin(sheet.turn)
  const flatX = px * cos - py * sin
  const flatY = px * sin + py * cos

  // How far off it is, as the share of its own size that is left of it. The hero's own row
  // is one; the horizon is nought.
  const share = sheet.horizon / (sheet.horizon - flatY)
  const held = Math.min(NEAREST, Math.max(DEEPEST, share))
  const scale = 1 + (held - 1) * sheet.tilt

  // The projection: off the centre line by its own share, and up the screen towards the
  // horizon by what that share leaves. Blended with the flat place rather than with the
  // flat scale, because at nought tilt the drawn place has to be the laid-out one exactly.
  const dx = flatX * (scale - 1)
  const dy = (-sheet.horizon * (1 - scale) - flatY) * sheet.tilt

  // And back into the sheet's own frame, which is the turn and the zoom taken off again.
  return {
    x: x + (dx * cos + dy * sin) / sheet.scale,
    y: y + (-dx * sin + dy * cos) / sheet.scale,
    scale,
  }
}

// How much of the country the canvas sees once the sheet is tilted, in screen points off the
// hero's own row: how far up the sheet the top edge reaches, how far down the bottom edge
// does, and the widest the sheet runs anywhere on it.
//
// What the land is grown in, and all three are past the canvas's own measure — what the tilt
// buys in depth it pays for in cells.
export function tiltedWindow(canvas: { width: number; height: number }): {
  up: number
  down: number
  wide: number
} {
  const horizon = horizonOf(canvas.height)
  const anchorY = canvas.height * ANCHOR
  // The projection run backwards: how far up the sheet a mark is if it is drawn `seen`
  // points below the hero's row.
  const flatAt = (seen: number): number => {
    const share = 1 + seen / horizon
    return horizon * (1 - 1 / share)
  }
  // What a mark on the top edge of the canvas is drawn at, which is the smallest anything on
  // it is and so the widest the sheet reaches.
  const furthest = Math.max(DEEPEST, 1 - anchorY / horizon)
  return {
    up: -flatAt(-anchorY),
    down: flatAt(canvas.height - anchorY),
    wide: canvas.width / 2 / furthest,
  }
}

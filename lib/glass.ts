import { lerpColor } from '@/machines/modes'

// Glass, as the app's three big titles wear it: NINE on the intro screen, the pause mark,
// and the game-over claim.
//
// There is nothing behind any of them to see through — every overlay draws `bg-surface`
// and the screen under it is opaque — so none of this is a backdrop blur, which would
// blur a flat colour and show nothing for it. What reads as glass on a plain window is
// the edge work: a pane you can see the surface through, a lit rim along the top where
// the light catches the edge, a darker far edge where the glass turns away, and a soft
// shadow underneath saying the pane is off the surface rather than printed on it.
//
// Nothing here picks a colour. The pane is the colour it was handed with the surface
// coming through it, and the two edges are that same colour lifted towards white or
// pushed towards black — so the mode gradient, its cycling and the arcade amber all keep
// their hue, and only the value and the alpha move.

// How much of its own colour the pane keeps. The rest is whatever is behind it, which on
// the intro screen is the surface and on a record's game-over screen is the gold — glass
// over gold going gold is the whole point of it being glass.
//
// Held this high because the pane is also the letter: the title is the one thing on the
// screen that has to read from across a room, and a pane thin enough to be unmistakably
// glass is a title nobody can see. This is the compromise, and it is the number to move
// if the effect wants to be stronger.
export const GLASS_TINT = 0.72

// The lit rim along the top of the glyph and the far edge along its foot, in pixels.
// Crisp, both of them: an edge is where the glass stops, and a soft edge is a glow.
export const GLASS_RIM_PX = 2
export const GLASS_FAR_PX = 3

// How much the bands overshoot the cap box, so that a font whose capitals sit a pixel or
// two off where this expects still gets its edges lit. Overshoot costs nothing — a band
// is a window onto the glyph, and a window past the end of it shows nothing.
export const GLASS_OVERSHOOT_PX = 2

// How far each edge travels off the pane's colour — 0 is the colour itself, 1 is white or
// black — and how solid each is. The rim is nearly opaque because a lit edge is the one
// part of a pane that is not see-through.
export const GLASS_RIM_LIFT = 0.72
export const GLASS_RIM_ALPHA = 0.95
export const GLASS_FAR_SHADE = 0.35
export const GLASS_FAR_ALPHA = 0.85

// The sheen: the pane's own surface catching the light, strongest at the top and gone by
// the time it reaches the middle. White rather than the letter's colour, since a
// reflection is the light's colour and not the thing's.
export const GLASS_SHEEN_ALPHA = 0.16
export const GLASS_SHEEN_UNTIL = 0.38

// How many steps the sheen falls off in, on a glyph.
//
// A rectangle takes a gradient and the pause bars use one. A letter cannot: the only way
// to give part of a glyph its own colour is to show a slice of a copy of it, and a slice
// has a hard edge. One slice ends the sheen on a line drawn across the letter, which
// reads as a band of a different colour rather than as light falling off — so it is cut
// into four, each one fainter, and four steps at these alphas is under a tenth of an
// alpha apiece. Close enough to a fade that the eye stops finding the edges.
export const GLASS_SHEEN_STEPS = 4

// The shadow the pane floats on. Down and soft, the way everything in this app is lit
// from straight above. Twice, because a glyph casts its shadow through the text style and
// a rectangle through the view's — the same shadow, spelled the two ways the platform
// asks for it.
const SHADOW_COLOR = 'rgba(11, 12, 20, 0.28)'
const SHADOW_DROP = 3
const SHADOW_BLUR = 7

export const GLASS_SHADOW = {
  textShadowColor: SHADOW_COLOR,
  textShadowOffset: { width: 0, height: SHADOW_DROP },
  textShadowRadius: SHADOW_BLUR,
} as const

export const GLASS_PANE_SHADOW = {
  boxShadow: `0px ${SHADOW_DROP}px ${SHADOW_BLUR}px ${SHADOW_COLOR}`,
} as const

const WHITE = '#ffffff'
const BLACK = '#000000'

export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// One colour, read as a pane of glass.
export type GlassTones = {
  // The pane itself, with the surface coming through.
  pane: string
  // The lit edge along the top.
  rim: string
  // The far edge along the foot, where the glass turns away from the light.
  far: string
}

export const glassTones = (base: string): GlassTones => ({
  pane: withAlpha(base, GLASS_TINT),
  rim: withAlpha(lerpColor(base, WHITE, GLASS_RIM_LIFT), GLASS_RIM_ALPHA),
  far: withAlpha(lerpColor(base, BLACK, GLASS_FAR_SHADE), GLASS_FAR_ALPHA),
})

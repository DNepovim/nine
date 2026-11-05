import { VariableContextProvider } from 'nativewind'
import { createContext, useContext, type ReactNode } from 'react'
import type { TextStyle } from 'react-native'

import { SCHEMES } from '@/constants/colors'
import { readableOn } from '@/lib/contrast'
import type { SchemeKind } from '@/modes'

// The **scheme** the game screen is being played under, for everything on it.
//
// Two halves, because the game screen is drawn two ways. Most of it is classes, and those
// re-ink themselves through the token overrides — the same `VariableContextProvider` the
// painted game-over screens use. The rest computes a colour in JS (a worklet, an icon's
// `color` prop) and cannot see a token, so it asks `useScheme()` for the scheme's inks.
//
// The value handed down is the `SCHEMES` entry itself, a module constant, so its identity
// only changes when the kind does: an animated style reading an ink does not re-run on
// every render of the screen above it.
type SchemeValue = (typeof SCHEMES)[SchemeKind]

const SchemeContext = createContext<SchemeValue>(SCHEMES.day)

// A scheme worn in one ink: `base` with every colour in it that is drawn in JS or taken from a
// token turned to `ink`, or to the scheme's own bar ink where `ink` cannot be read on its
// ground. What puts every item in a challenge's top bar in one colour when the challenge has
// no monochrome scheme of its own. Kept per base and ink, so the value handed down is the same
// one on every render, as the table's entries are.
const tinted = new Map<string, SchemeValue>()

function tintedScheme(kind: SchemeKind, ink: string): SchemeValue {
  const key = `${kind}:${ink}`
  const known = tinted.get(key)
  if (known !== undefined) return known
  const base = SCHEMES[kind]
  const one = readableOn(ink, base.inks.ground, base.inks.bar ?? base.inks.ink)
  // Narrower than it is typed — the table's entries are literals — which nothing reads.
  const scheme = {
    tokens: {
      ...base.tokens,
      '--color-dim': one,
      '--color-primary': one,
      '--color-strong': one,
      '--color-score': one,
      '--color-fortune': one,
      '--color-factor': one,
    },
    inks: {
      ...base.inks,
      score: one,
      ink: one,
      mono: one,
      bar: one,
      keyRim: 'transparent',
      keys: null,
    },
  }
  tinted.set(key, scheme as unknown as SchemeValue)
  return scheme as unknown as SchemeValue
}

export function SchemeProvider({
  kind,
  ink = null,
  children,
}: {
  kind: SchemeKind
  // Wear everything in this one ink, where the scheme has none of its own. See `tintedScheme`.
  ink?: string | null
  children: ReactNode
}) {
  const scheme = ink === null ? SCHEMES[kind] : tintedScheme(kind, ink)
  return (
    <SchemeContext.Provider value={scheme}>
      <VariableContextProvider value={scheme.tokens}>{children}</VariableContextProvider>
    </SchemeContext.Provider>
  )
}

// Outside any provider this is `day`, which is what every screen but the game screen is.
export const useScheme = (): SchemeValue => useContext(SchemeContext)

// A colour computed in JS, made safe for the scheme it is drawn on.
//
// The colours a screen hands its parts — a mode's accent, a challenge's ink — are tuned
// for the app's own light screen, and on it they are drawn exactly as given. Under another
// scheme each is kept only where it still reads (`readableOn`), and is the scheme's text
// ink where it does not: BLACKOUT's black name and black session cell on its dark screen.
//
// A **monochrome** scheme answers its one ink for every colour, readable or not: `dos`
// draws nothing in any colour but its own two.
export function useLegible(): (color: string) => string {
  const scheme = useScheme()
  const { mono, ground, ink } = scheme.inks
  return (color) => {
    if (mono !== null) return mono
    return scheme === SCHEMES.day ? color : readableOn(color, ground, ink)
  }
}

// The neon corona a scheme draws round its text and icons, as a text shadow — or nothing, for a
// scheme with none. Put in the `style` of whatever should glow; the shadow takes the colour of
// the glyph's own pixels' edge, so it reads as light round it.
const NO_GLOW: TextStyle = {}

// The glow of a scheme's colour as a text style, for whoever has the scheme in hand rather than
// under a provider.
export const glowStyle = (glow: string | null): TextStyle =>
  glow === null
    ? NO_GLOW
    : {
        textShadowColor: glow,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 9,
      }

export const useGlow = (): TextStyle => glowStyle(useScheme().inks.glow)

import { VariableContextProvider } from 'nativewind'
import { createContext, useContext, type ReactNode } from 'react'

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

export function SchemeProvider({
  kind,
  children,
}: {
  kind: SchemeKind
  children: ReactNode
}) {
  const scheme = SCHEMES[kind]
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

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'

export type Viewport = { width: number; height: number }

// The area the app actually occupies. On a phone that is the window, and this is
// `useWindowDimensions` under another name. On a desktop browser the app runs inside
// a phone-shaped frame, and the window is the desk it sits on — anything that sizes
// itself to "the screen" (a confetti spread, the dying sequence's flight path) has to
// mean the frame, or it lands outside the app and is clipped away.
const ViewportContext = createContext<Viewport | null>(null)

/**
 * Wraps the app in a viewport smaller than the window. Only the web build's phone
 * frame has one to declare, and knip does not follow platform variants, so the tag
 * is what stops this reading as dead code.
 *
 * @public
 */
export function ViewportProvider({
  width,
  height,
  children,
}: Viewport & { children: ReactNode }) {
  return (
    <ViewportContext.Provider value={{ width, height }}>
      {children}
    </ViewportContext.Provider>
  )
}

// What the static export saw: `expo export` renders every screen in Node, where there
// is no window, so `useWindowDimensions` answers 0 x 0 and whatever was sized from it
// is written into the HTML at zero.
const UNMEASURED: Viewport = { width: 0, height: 0 }

// Whether this render is the browser's own rather than a replay of the server's.
//
// Hydration does not rewrite inline styles. React compares the incoming render against
// what it believes the DOM holds, and after hydrating it believes the DOM holds the
// values it just rendered — so a client render that goes straight to the real size
// agrees with itself while the page still shows the server's zero, and nothing ever
// patches it. That is how a dial of nine zero-width buttons reached production and
// stayed there: every measurement on the client was correct, and none of them landed.
//
// So the first client render deliberately repeats the server's zero, and the size
// arrives on the render after mount — a change React can see, and therefore write.
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  return hydrated
}

export function useViewport(): Viewport {
  const framed = useContext(ViewportContext)
  const measured = useWindowDimensions()
  const hydrated = useHydrated()
  if (framed !== null) return framed
  return hydrated ? measured : UNMEASURED
}

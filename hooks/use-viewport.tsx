import { createContext, useContext, type ReactNode } from 'react'
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

export function useViewport(): Viewport {
  const framed = useContext(ViewportContext)
  const window = useWindowDimensions()
  return framed ?? window
}

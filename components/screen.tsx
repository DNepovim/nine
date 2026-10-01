import { useEffect, useState, type ReactNode } from 'react'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { LAYER } from '@/constants/layers'

const ENTER_MS = 200
const EXIT_MS = 160

// How many screens are covering the viewport right now, and when the last one left.
// The count alone would miss the screen on its way out: React unmounts it the moment it
// is replaced, while Reanimated goes on drawing its fade for another EXIT_MS.
let live = 0
let lastExitAt = 0

function screenPresent(): boolean {
  return live > 0 || Date.now() - lastExitAt < EXIT_MS
}

// A screen replaces the one before it by appearing *underneath* it, fully drawn, and
// letting the old one fade off the top. Fading the new one in at the same time is what
// made the game flash between them — for those few frames neither screen was opaque and
// the live dial showed through the pair.
//
// So a screen that arrives over another one skips its own fade and sits a step below
// `LAYER.screen` until the one it replaced has finished leaving. A screen that arrives
// over the game instead — the pause screen, game over — has nothing to replace and
// fades in, which is where the fade was always worth having.
function useArrival(overRun: boolean) {
  // Decided during the first render. An effect would be too late: React runs the
  // outgoing screen's cleanup before the incoming screen's effects, so by then the
  // answer would always be "nothing there".
  //
  // `overRun` is the answer being overridden: a screen that arrives over a *live run* has
  // nothing to replace and should fade in, which is what the game's pause screen does by
  // simply not finding another screen present. Arcade's run is itself drawn in a
  // `ScreenLayer`, so its pause screen finds one and would take the replacement path —
  // arriving without a fade over a board that is not going anywhere.
  const [replacing] = useState(() => !overRun && screenPresent())
  const [settled, setSettled] = useState(!replacing)

  useEffect(() => {
    live += 1
    return () => {
      live -= 1
      lastExitAt = Date.now()
    }
  }, [])

  useEffect(() => {
    if (settled) return
    const id = setTimeout(() => {
      setSettled(true)
    }, EXIT_MS)
    return () => {
      clearTimeout(id)
    }
  }, [settled])

  return { replacing, settled }
}

// A full-viewport screen: the theme background, the shared transition, the shared place
// in the stack. Everything the player reads as "a screen" goes through this — `Screen
// overlay` for the ones on the standard padding, this directly for the few that carry
// their own (the guide, the archive, a lesson).
export function ScreenLayer({
  children,
  className = '',
  overRun = false,
}: {
  children: ReactNode
  className?: string
  // This screen is arriving over a live run rather than over another screen, so it fades in
  // like the pause screen and game over do. See `useArrival`.
  overRun?: boolean
}) {
  const { replacing, settled } = useArrival(overRun)
  return (
    <Animated.View
      entering={replacing ? undefined : FadeIn.duration(ENTER_MS)}
      exiting={FadeOut.duration(EXIT_MS)}
      style={{ zIndex: settled ? LAYER.screen : LAYER.arrivingScreen }}
      className={`absolute inset-0 bg-surface ${className}`}
    >
      {children}
    </Animated.View>
  )
}

// Consistent padding for every screen. `overlay` screens fill the viewport with
// the theme background; by default they center their content vertically.
// Pass `topAligned` to anchor content to the top instead (with fixed top padding).
export function Screen({
  children,
  overlay = false,
  topAligned = false,
  overRun = false,
}: {
  children: ReactNode
  overlay?: boolean
  topAligned?: boolean
  // Passed through to `ScreenLayer`: this one arrives over a live run, so it fades.
  overRun?: boolean
}) {
  if (overlay) {
    return (
      <ScreenLayer
        overRun={overRun}
        className={`items-center px-4 py-2 ${topAligned ? 'justify-start pt-12' : 'justify-center'}`}
      >
        {children}
      </ScreenLayer>
    )
  }
  // The game, which is not stacked over anything and stays in the flow.
  return (
    <Animated.View
      entering={FadeIn.duration(ENTER_MS)}
      exiting={FadeOut.duration(EXIT_MS)}
      className="flex-1 px-4 py-2"
    >
      {children}
    </Animated.View>
  )
}

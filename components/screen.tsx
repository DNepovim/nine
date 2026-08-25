import type { ReactNode } from 'react'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

// Consistent padding for every screen. `overlay` screens fill the viewport with
// the theme background; by default they center their content vertically.
// Pass `topAligned` to anchor content to the top instead (with fixed top padding).
//
// Every screen fades in on mount and out on unmount, one place rather than each
// overlay wiring its own — so switching between them never lands as a hard cut.
export function Screen({
  children,
  overlay = false,
  topAligned = false,
}: {
  children: ReactNode
  overlay?: boolean
  topAligned?: boolean
}) {
  const overlayClasses = overlay
    ? `absolute inset-0 items-center ${topAligned ? 'justify-start pt-12' : 'justify-center'} bg-surface`
    : 'flex-1'
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      className={`px-4 py-2 ${overlayClasses}`}
    >
      {children}
    </Animated.View>
  )
}

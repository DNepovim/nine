import type { ReactNode } from 'react'
import { View } from 'react-native'

// Consistent padding for every screen. `overlay` screens fill the viewport with
// the theme background; by default they center their content vertically.
// Pass `topAligned` to anchor content to the top instead (with fixed top padding).
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
  return <View className={`px-4 py-2 ${overlayClasses}`}>{children}</View>
}

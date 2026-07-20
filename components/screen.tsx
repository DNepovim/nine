import type { ReactNode } from 'react'
import { View } from 'react-native'

// Consistent padding for every screen. `overlay` screens fill the viewport with
// the theme background and center their content; the plain (game) screen is a
// padded flex column.
export function Screen({
  children,
  overlay = false,
}: {
  children: ReactNode
  overlay?: boolean
}) {
  const overlayClasses = overlay
    ? 'absolute inset-0 items-center justify-center bg-surface'
    : 'flex-1'
  return <View className={`px-4 py-2 ${overlayClasses}`}>{children}</View>
}

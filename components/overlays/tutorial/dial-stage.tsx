import type { ReactNode } from 'react'
import { View } from 'react-native'

import { SUM_ROW_HEIGHT } from '@/hooks/use-game-dial-size'

// Mirrors the lower half of the game screen: a flexible targets area, the sum
// readout in its fixed slot, then the dial pad. Lessons compose into these three
// bands so every element lands where the player will meet it in a real game —
// including the empty ones, which still hold their space.
export function DialStage({
  above,
  readout,
  dialSize,
  children,
}: {
  above: ReactNode
  readout: ReactNode
  dialSize: number
  children: ReactNode
}) {
  return (
    <>
      <View className="flex-1 items-center justify-center">{above}</View>
      <View className="items-center justify-center" style={{ height: SUM_ROW_HEIGHT }}>
        {readout}
      </View>
      <View className="items-center justify-center" style={{ height: dialSize }}>
        {children}
      </View>
    </>
  )
}

import { View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import {
  LEVER_H,
  LEVER_W,
  LeverDrawing,
  useLeverBox,
} from '@/components/game/openings/lever-drawing'

// The lever in the scene, pulled for the player.
export function LeverInScene({ pull }: { pull: SharedValue<number> }) {
  const { top } = useLeverBox()
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', right: 0, top, width: LEVER_W, height: LEVER_H }}
    >
      <LeverDrawing pull={pull} />
    </View>
  )
}

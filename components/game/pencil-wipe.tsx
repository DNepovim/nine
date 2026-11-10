import { useState, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'

import { useScheme } from '@/hooks/use-scheme'
import { phaseOf } from '@/lib/dial-sketch'

// A thing on the drawing board being drawn in: it comes into view from its left edge to its right
// as `progress` passes through `window`, the way a line is ruled, rather than fading in.
//
// A sheet of the scheme's own paper lies over it and is drawn back to the right, shrinking from
// the left, so nothing about the thing's own layout changes while it is drawn — its box is the one
// it will have — and the sheet never leaves that box, so what flies out of the thing afterwards (a
// lost heart, a score's floating points) is not clipped. With no `progress` it is simply there and
// costs nothing — it draws no box at all — which is every run that is not an opening's.
export function PencilWipe({
  progress,
  window,
  style,
  children,
}: {
  progress: SharedValue<number> | null
  window: readonly [number, number]
  // The box's own style, where it has to take a share of a row rather than the size of what is in
  // it.
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const { ground } = useScheme().inks
  const width = useSharedValue(0)
  const [measured, setMeasured] = useState(false)
  const sheet = useAnimatedStyle(() => {
    const done = phaseOf(progress?.value ?? 1, window)
    return {
      // Gone altogether once drawn, so no edge of it is left lying on the thing.
      opacity: done >= 1 || !measured ? 0 : 1,
      left: done * width.value,
      width: (1 - done) * width.value,
    }
  })
  if (progress === null) return <>{children}</>
  return (
    <View
      style={style}
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width
        setMeasured(true)
      }}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, bottom: 0, backgroundColor: ground },
          sheet,
        ]}
      />
    </View>
  )
}

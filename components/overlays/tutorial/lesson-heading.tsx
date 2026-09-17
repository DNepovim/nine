import type { ReactNode } from 'react'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

// Shared top block for every lesson: the screen's name and its explanation.
//
// Title and explanation fade up on their own beat, a touch apart — the same
// cascade every lesson opens with, since every lesson opens through here.
//
// Primary, not dim: matches Body in how-to-play-overlay, the guide's own prose
// colour. Dim reads as an aside next to the accent title; this line is the
// screen's one sentence of instruction and earns the same weight the guide gives it.
export function LessonHeading({
  title,
  color,
  children,
}: {
  // Nodes rather than strings so a caller can hand these a <Trans>; both render
  // inside the <Animated.Text> below exactly as a literal did.
  title: ReactNode
  color: string
  children: ReactNode
}) {
  return (
    <View className="mt-4">
      <Animated.Text
        entering={FadeInDown.duration(380)}
        selectable={false}
        className="font-mono text-[19px] font-black tracking-[2.5px]"
        style={{ color }}
      >
        {title}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(90).duration(380)}
        selectable={false}
        className="mt-2 font-mono text-[12px] font-medium leading-[19px] text-primary"
      >
        {children}
      </Animated.Text>
    </View>
  )
}

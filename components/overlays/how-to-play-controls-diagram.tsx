import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// A single dial button surrounded by its gesture hints.
export function HowToPlayControlsDiagram() {
  const hint = (label: string) => (
    <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
      {label}
    </Text>
  )
  return (
    <View className="items-center py-1">
      {/* Tap takes the slot swipe up used to hold — it is the gesture that does that
          job, and one label per direction keeps the diagram readable. */}
      {hint('TAP  +1')}
      <View className="my-1.5 flex-row items-center gap-3">
        {hint('◀ SET 0')}
        <View className="h-16 w-16 items-center justify-center rounded-full bg-strong">
          <Text
            selectable={false}
            className="font-mono text-[26px] font-medium text-on-strong"
          >
            5
          </Text>
        </View>
        {hint('SET 9 ▶')}
      </View>
      {hint('SWIPE DOWN  −1')}
    </View>
  )
}

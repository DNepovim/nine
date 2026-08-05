import { Text, View } from 'react-native'

import { APP_BLUE } from '@/constants/colors'

// A target at full clock — the same disc PieCountdown draws, minus the countdown.
// Used where the ring is illustrative rather than ticking.
export function TargetBadge({ value, size }: { value: number; size: number }) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: APP_BLUE }}
    >
      <Text
        selectable={false}
        className="font-mono font-extrabold text-pie"
        style={{ fontSize: Math.round(size * 0.42), includeFontPadding: false }}
      >
        {value}
      </Text>
    </View>
  )
}

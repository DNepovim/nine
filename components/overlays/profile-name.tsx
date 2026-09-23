import { View } from 'react-native'

import { GradientName } from '@/components/gradient-name'

// The nickname at the top of a player's profile, at the one size it gets a whole line to
// itself. Everything about *what* colour it is lives in `lib/name-gradient.ts`; this file
// owns only how big it is drawn.
//
// The profile is also the one screen where the gradient explains itself. AVG ACC and
// AVG SPD are printed a few rows below it, so a player who wonders why their name looks
// the way it does can find the two numbers that decided it without a legend. Nowhere else
// the name appears can say that, which is why this screen sets it largest.
export function ProfileName({
  nickname,
  avgAccuracy,
  avgSpeed,
}: {
  nickname: string
  avgAccuracy: number | null
  avgSpeed: number | null
}) {
  return (
    <View className="flex-row justify-center">
      <GradientName
        nickname={nickname}
        avgAccuracy={avgAccuracy}
        avgSpeed={avgSpeed}
        className="text-center font-mono text-[28px] font-black tracking-[3px] leading-[34px]"
      />
    </View>
  )
}

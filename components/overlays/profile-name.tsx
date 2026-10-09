import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'

// The nickname at the top of a player's profile, at the one size it gets a whole line to
// itself. Everything about *what* colour it is lives in `lib/name-gradient.ts`; this file
// owns only how big it is drawn.
//
// The profile is also the one screen where the gradient explains itself. AVG ACC and
// AVG SPD are printed a few rows below it, so a player who wonders why their name looks
// the way it does can find the two numbers that decided it without a legend. Nowhere else
// the name appears can say that, which is why this screen sets it largest.

// The pencil beside it. A size up from the motto's, because it sits against 28px type and
// a glyph matched to the smaller line would read as a speck next to the name.
const ICON = 13
export function ProfileName({
  nickname,
  avgAccuracy,
  avgSpeed,
  // Only ever given on the profile of the player holding the phone, and drawn as the same
  // pencil the motto under it wears — the two are one pair of things about yourself that
  // you wrote, so the way in to rewriting them has to look the same. See `ProfileMotto`.
  onEdit,
}: {
  nickname: string
  avgAccuracy: number | null
  avgSpeed: number | null
  onEdit?: () => void
}) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      <GradientName
        nickname={nickname}
        avgAccuracy={avgAccuracy}
        avgSpeed={avgSpeed}
        className="text-center font-mono text-[28px] font-black tracking-[3px] leading-[34px]"
      />
      {onEdit !== undefined && (
        <TrackedPressable id="profile.edit_nickname" onPress={onEdit} hitSlop={12}>
          <Ionicons name="create-outline" size={ICON} color={DIM_INK} />
        </TrackedPressable>
      )}
    </View>
  )
}

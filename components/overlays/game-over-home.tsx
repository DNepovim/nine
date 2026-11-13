import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK, GOLD_DIM_INK } from '@/constants/colors'
import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The way home. Not `RunExit`, which the pause screen uses: this one has the painted
// screens to answer for, and its icon's colour is computed rather than a class so the
// gold screen's re-bound tokens cannot reach it — it takes the gold dim directly or it
// stays a theme grey on a gold background.
export function GameOverHome({
  onGold,
  painted,
  onPress,
}: {
  onGold: boolean
  painted: boolean
  onPress: () => void
}) {
  return (
    <TrackedPressable id="game_over.home" onPress={onPress} hitSlop={10}>
      <View className="flex-row items-center gap-1">
        <Ionicons
          name="home-outline"
          size={10}
          color={onGold ? GOLD_DIM_INK : painted ? '#FFFFFF' : DIM_INK}
        />
        <Text
          selectable={false}
          className={cn(TYPE.quietAction, 'text-dim')}
          style={painted ? ON_GOLD_LABEL_SHADOW : null}
        >
          <Trans>HOME</Trans>
        </Text>
      </View>
    </TrackedPressable>
  )
}

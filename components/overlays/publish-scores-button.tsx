import { Trans } from '@lingui/react/macro'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// Shown under the board for as long as the player has no nickname — the one thing
// standing between their scores and the real leaderboard, whether those scores are
// already on the device or still to be played.
//
// The button carries the call to action; the reason sits under it, outside the pill,
// so the button itself stays as short as the mode gradients it borrows from. The reason
// reads forward on purpose — a player with nothing saved yet is being told what the
// nickname is for, not what it would rescue.
//
// Offline it dims and stops answering: claiming a nickname is a Supabase round trip, so
// there is nothing behind the tap until the connection is back. The reason is already on
// screen — `OfflineNotice` sits directly above it.
export function PublishScoresButton({
  from,
  to,
  disabled = false,
  onPress,
}: {
  from: string
  to: string
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <View className="mt-3 items-center">
      <TrackedPressable
        id="profile.publish_scores"
        onPress={onPress}
        disabled={disabled}
        hitSlop={8}
        className={cn('overflow-hidden rounded-xl', disabled && 'opacity-40')}
      >
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          className="items-center px-5 py-2.5"
        >
          <Text selectable={false} className={cn(TYPE.heading, 'text-white')}>
            <Trans>ADD YOUR NICKNAME</Trans>
          </Text>
        </LinearGradient>
      </TrackedPressable>
      <Text selectable={false} className={cn(TYPE.caption, 'mt-1.5 text-dim')}>
        <Trans>TO PUBLISH YOUR BESTS</Trans>
      </Text>
    </View>
  )
}

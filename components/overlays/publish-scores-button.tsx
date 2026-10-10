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
// Under both, the other answer to the same question: a player with no nickname on this
// phone may already have one on another, and claiming a fresh name would leave that
// career where it is. Quiet rather than a second pill, because it is the rarer of the two
// — most players pressing here have nothing to come back to — so it reads as the way out
// beside the ask rather than as a rival to it. `quietAction` without the underline the
// rest of the house's quiet links wear: this one sits directly under a caption rather
// than alone at the foot of a card, and a rule under the lower of two stacked lines of
// small caps reads as something dividing them.
//
// Offline it dims and stops answering: claiming a nickname is a Supabase round trip, so
// there is nothing behind the tap until the connection is back. The reason is already on
// screen — `OfflineNotice` sits directly above it. The way back is the same trade for the
// same reason — a code is sent by the server — so the two dim together.
export function PublishScoresButton({
  from,
  to,
  disabled = false,
  onPress,
  onRestore,
}: {
  from: string
  to: string
  disabled?: boolean
  onPress: () => void
  // Opens the address card, where one field answers both halves of *this is me* — see
  // `EmailModal`. Left off where a restore would cost the player something they are in
  // the middle of: it signs this device out and reloads the app, so the pause screen
  // offers the nickname alone and the way back waits for the intro.
  onRestore?: () => void
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
      {onRestore !== undefined && (
        <TrackedPressable
          id="profile.restore"
          onPress={onRestore}
          disabled={disabled}
          hitSlop={10}
          className={cn('mt-2.5', disabled && 'opacity-40')}
        >
          <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
            <Trans>OR RESTORE YOUR PROFILE</Trans>
          </Text>
        </TrackedPressable>
      )}
    </View>
  )
}

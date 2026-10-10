import { Trans } from '@lingui/react/macro'
import { View } from 'react-native'

import { GradientName } from '@/components/gradient-name'

import { PILL_INSET, ProfilePill, ProfilePillFloat } from './profile-pill'

// The nickname at the top of a player's profile, at the one size it gets a whole line to
// itself. Everything about *what* colour it is lives in `lib/name-gradient.ts`; this file
// owns only how big it is drawn.
//
// The profile is also the one screen where the gradient explains itself. AVG ACC and
// AVG SPD are printed a few rows below it, so a player who wonders why their name looks
// the way it does can find the two numbers that decided it without a legend. Nowhere else
// the name appears can say that, which is why this screen sets it largest.
//
// The name is centred in the card and the pencil floats beside it rather than sitting in
// the line — a button in the row pushes the thing it is about off centre, which on the
// one line a player came to see their own name on was the button winning an argument it
// should not have been in. See `ProfilePillFloat`.
export function ProfileName({
  // Null for a profile with no name on it yet. On your own card that is the whole of what
  // is on screen — there is nothing to centre and nothing to rewrite, only the one thing
  // to do — so the pill stands in for the line entirely.
  nickname,
  avgAccuracy,
  avgSpeed,
  // Only ever given on the profile of the player holding the phone, and drawn as the same
  // pill the motto under it wears — the two are one pair of things about yourself that
  // you wrote, so the way in to writing them has to look the same. See `ProfileMotto`.
  onEdit,
}: {
  nickname: string | null
  avgAccuracy: number | null
  avgSpeed: number | null
  onEdit?: () => void
}) {
  if (nickname === null) {
    // A stranger's card cannot reach this in practice — without a name there is no board
    // to meet them on and so no row to open — but it is drawn rather than left blank,
    // because a card with its first line missing reads as a card that failed to load.
    if (onEdit === undefined) {
      return (
        <View className="items-center">
          <GradientName
            nickname="…"
            avgAccuracy={avgAccuracy}
            avgSpeed={avgSpeed}
            className="text-center font-mono text-[28px] font-black leading-[34px] tracking-[3px]"
          />
        </View>
      )
    }
    return (
      <View className="items-center">
        <ProfilePill
          id="profile.add_nickname"
          label={<Trans>ADD NICKNAME</Trans>}
          onPress={onEdit}
        />
      </View>
    )
  }

  return (
    <View className="justify-center">
      <GradientName
        nickname={nickname}
        avgAccuracy={avgAccuracy}
        avgSpeed={avgSpeed}
        className={`${PILL_INSET} text-center font-mono text-[28px] font-black leading-[34px] tracking-[3px]`}
      />
      {onEdit !== undefined && (
        <ProfilePillFloat>
          <ProfilePill id="profile.edit_nickname" onPress={onEdit} />
        </ProfilePillFloat>
      )}
    </View>
  )
}

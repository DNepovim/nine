import { Text } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { InlineMarks } from '@/components/player-mark'
import { TYPE } from '@/constants/typography'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import type { PlayerMark } from '@/lib/champions'

export type WinnerNameProps = {
  // Whose name it is — the stripe's name opens their profile, the same as a board row.
  userId: string
  nickname: string
  // Every mark this player wears everywhere their name appears — a board standing, a
  // phoenix for taking the last challenge, or both at once. Empty where they wear none.
  marks: readonly PlayerMark[]
  // What the name is coloured by. Null where the counters have never seen this player.
  avgAccuracy: number | null
  avgSpeed: number | null
}

// A drawn mark's side, matched to the line's `TYPE.value` text.
const MARK_SIZE = 11

// A winner's name inside a sentence: their champion mark, then the nickname in the
// gradient their own play earned.
//
// Its own component because it is what the translated sentence wraps around — the
// name moves to a different place in Czech than in English, and a `<0/>` the
// translator can put anywhere is what makes that possible.
//
// The board's colour used to paint this name, which is what the stripe's `color` prop
// carried. It no longer does: a name means its player everywhere else in the app, and
// the one place it meant the board instead was this sentence. The board is still said —
// the line around the name is drawn in it — so nothing is lost but the collision.
export function WinnerName({
  userId,
  nickname,
  marks,
  avgAccuracy,
  avgSpeed,
}: WinnerNameProps) {
  const openProfile = useOpenProfile()
  return (
    <Text
      selectable={false}
      // `onPress` on the Text rather than a wrapping Pressable: this sits inside a
      // translated sentence, and a View around it would break the line it is part of.
      onPress={() => {
        openProfile(userId)
      }}
      className={TYPE.value}
    >
      <InlineMarks marks={marks} size={MARK_SIZE} />
      <GradientName nickname={nickname} avgAccuracy={avgAccuracy} avgSpeed={avgSpeed} />
    </Text>
  )
}

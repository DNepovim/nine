import { Text } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { useOpenProfile } from '@/hooks/use-profile-modal'

export type WinnerNameProps = {
  // Whose name it is — the stripe's name opens their profile, the same as a board row.
  userId: string
  nickname: string
  // The crown or bird this player wears everywhere their name appears, or null.
  mark: string | null
  // What the name is coloured by. Null where the counters have never seen this player.
  avgAccuracy: number | null
  avgSpeed: number | null
}

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
  mark,
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
      className="font-mono text-[10px] font-bold tracking-[0.5px]"
    >
      {mark === null ? '' : `${mark} `}
      <GradientName nickname={nickname} avgAccuracy={avgAccuracy} avgSpeed={avgSpeed} />
    </Text>
  )
}

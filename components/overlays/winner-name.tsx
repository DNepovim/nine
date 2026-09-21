import { Text } from 'react-native'

import { useOpenProfile } from '@/hooks/use-profile-modal'

export type WinnerNameProps = {
  // Whose name it is — the stripe's name opens their profile, the same as a board row.
  userId: string
  nickname: string
  // The crown or bird this player wears everywhere their name appears, or null.
  mark: string | null
  // The board's own colour — see RecentWinners for why the name carries it.
  color: string
}

// A winner's name inside a sentence: their champion mark, then the nickname in the
// board's colour.
//
// Its own component because it is what the translated sentence wraps around — the
// name moves to a different place in Czech than in English, and a `<0/>` the
// translator can put anywhere is what makes that possible.
export function WinnerName({ userId, nickname, mark, color }: WinnerNameProps) {
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
      style={{ color }}
    >
      {mark === null ? nickname : `${mark} ${nickname}`}
    </Text>
  )
}

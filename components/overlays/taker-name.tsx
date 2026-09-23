import { Text } from 'react-native'

import { useOpenProfile } from '@/hooks/use-profile-modal'

// The name of whoever took a medal off you, on the lost-medal line. Flat, in whatever
// grey that line hands it.
//
// Deliberately not `WinnerName`, and deliberately not the gradient every other name in
// the app now wears. The lost-medal line's whole device is that the colour has been
// drained out of it — greyscale is what this app uses for a record taken off you — and a
// rival whose name bloomed into their own two hues would be the brightest thing on a
// line about your loss. The name is still the news here, which is why it stays a shade
// brighter than the words around it; it is just not a celebration of the player wearing
// it.
//
// Its own component rather than a `drained` flag on `WinnerName`, because the two are
// different sentences about different events and a shared component with a switch in it
// would invite the switch to be flipped by accident.
export function TakerName({
  userId,
  nickname,
  mark,
  color,
}: {
  userId: string
  nickname: string
  // The crown or bird this player wears everywhere their name appears, or null.
  mark: string | null
  // The line's own grey. Passed in rather than reached for here so the line decides how
  // drained it is, and the name cannot drift from the words beside it.
  color: string
}) {
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

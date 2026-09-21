import { Text, View } from 'react-native'

import { lerpColor, MODE_GRADIENT } from '@/machines/game'

// A nickname drawn the way the intro draws NINE: one letter per colour, stepping across
// a single two-stop gradient.
//
// One scale, not the whole spectrum. The app's own blue-to-violet pair — the first stop
// of the mode scale and the blue everything from the score to the icon is built on — so
// a name reads as this app's rather than as a rainbow. It is also mode-neutral on
// purpose: a player is not a mode, and colouring their name in one of the two they play
// would claim something about them that is not true.
//
// Split per character rather than run through a gradient fill: React Native has no text
// gradient, and the title on the intro screen solves it the same way — which is why the
// two look like the same idea rather than two attempts at it.
const NAME_GRADIENT = MODE_GRADIENT.trainee

export function ProfileName({ nickname }: { nickname: string }) {
  // `Array.from` rather than a spread or `.split('')`: it walks code points, so a
  // nickname with an emoji or a combining mark in it keeps its characters whole.
  const letters = Array.from(nickname)
  const last = Math.max(1, letters.length - 1)

  return (
    <View className="flex-row flex-wrap justify-center">
      {letters.map((char, index) => (
        <Text
          key={`${char}-${index}`}
          selectable={false}
          className="font-mono text-[28px] font-black tracking-[3px] leading-[34px]"
          style={{ color: lerpColor(NAME_GRADIENT[0], NAME_GRADIENT[1], index / last) }}
        >
          {char}
        </Text>
      ))}
    </View>
  )
}

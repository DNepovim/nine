import { Text } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { gradientOf } from '@/modes'

// The tutorial's colour, worn for the reason the lesson's cards wear it: this is the lesson
// speaking, not the game reporting anything.
const TINT = gradientOf('trainee')[0]

// The same arrival and exit the lesson's cards have, so the one thing it says without a
// card around it still reads as the same voice.
const ENTER = FadeIn.duration(260).easing(Easing.out(Easing.cubic))
const LEAVE = FadeOut.duration(160).easing(Easing.in(Easing.cubic))

// The lesson's first word, set in the middle of an empty board.
//
// Not a card, and that is the whole of the design: a card is a thing said *about*
// something else on the screen, and there is nothing else on the screen yet — the target
// waits for the tap that takes this away. So the words have no border, no beak and nothing
// behind them. They are simply what the board says before the lesson starts.
//
// It had a screen of its own once, a curtain over the whole app between the logo leaving
// and the board arriving. This is that screen with the screen taken off it.
export function TutorialIntro({ text }: { text: string }) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={ENTER}
      exiting={LEAVE}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      className="items-center justify-center px-6"
    >
      <Text
        selectable={false}
        className={cn(TYPE.button, 'text-center leading-[22px]')}
        style={{ color: TINT }}
      >
        {text}
      </Text>
    </Animated.View>
  )
}

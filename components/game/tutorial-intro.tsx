import { Text } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'

import { TUTORIAL_WELCOME_IN_MS, TUTORIAL_WELCOME_OUT_MS } from '@/constants/tutorial'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { gradientOf } from '@/modes'

// The tutorial's colour, worn for the reason the lesson's cards wear it: this is the lesson
// speaking, not the game reporting anything.
const TINT = gradientOf('trainee')[0]

// The splash screen's own two gestures, shortened.
//
// The logo fades up out of nothing and leaves by swelling as it dissolves — it grows past
// the frame rather than shrinking away, so the app does not read as receding from the
// player but as the player arriving through it. This is the one other thing in the app
// that holds the screen on its own before a run, and it is a continuation of that one: the
// same two gestures and the same easings, at about a third of their lengths — the splash
// holds the app for six seconds and has nothing else to do, where these three seconds are
// standing in front of a dealt board and can be tapped away at any point in them.
//
// The swell is the splash's exact 1.35, which is the figure doing the work — a scale read
// as "away through the frame" rather than as a wobble. The way in takes a plain
// withTiming's easing, which is what the splash's fade is given and so is ease-in-out.
//
// The way out is the splash's pair of curves written as two straight segments, because one
// keyframe carries one easing and the splash puts a different one on each half of the
// gesture: the logo's opacity runs out steadily while the scale accelerates past it. So the
// midpoint here holds a half-faded word at a scale only a quarter of the way up — the
// opacity reads as linear, the swell as accelerating, and the words have thinned before
// the target behind them is halfway in.
const LEAVE_SCALE = 1.35
const LEAVE_MID_SCALE = 1.09

const ENTER = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1, easing: Easing.inOut(Easing.quad) },
}).duration(TUTORIAL_WELCOME_IN_MS)

const LEAVE = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  50: { opacity: 0.5, transform: [{ scale: LEAVE_MID_SCALE }], easing: Easing.linear },
  100: { opacity: 0, transform: [{ scale: LEAVE_SCALE }], easing: Easing.linear },
}).duration(TUTORIAL_WELCOME_OUT_MS)

// The lesson's first word, set in the middle of an empty board.
//
// Not a card, and that is the whole of the design: a card is a thing said *about*
// something else on the screen, and there is nothing else on the screen yet — the target
// waits behind this until it fades, and the sum under it is dimmed while it stands. So the
// words have no border, no beak and nothing behind them. They are simply what the board
// says before the lesson starts, and they are set at the size the app's screen titles take
// rather than its cards': there is nothing here for them to be the headline of.
//
// It asks for nothing, so it is not dismissed: TUTORIAL_WELCOME_MS takes it away, and a
// tap only brings that forward.
//
// It had a screen of its own once, a curtain over the whole app between the logo leaving
// and the board arriving. This is that screen with the screen taken off it — which is why
// it still arrives and leaves the way that screen does.
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
        className={cn(TYPE.screenTitle, 'text-center leading-[28px]')}
        style={{ color: TINT }}
      >
        {text}
      </Text>
    </Animated.View>
  )
}

import { Trans } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { WinnerName, type WinnerNameProps } from '@/components/overlays/winner-name'
import { useChampionsContext } from '@/hooks/use-champions'
import { useRecentWinners } from '@/hooks/use-recent-winners'
import { championMark } from '@/lib/champions'
import type { WinnerWindow } from '@/lib/recent-winners'
import type { Difficulty, Mode } from '@/machines/game'

// The three things the stripe can say. A value map rather than a branch, so a new
// window could not be added to `WinnerWindow` without a sentence to go with it.
//
// Each sentence wraps the name in a component rather than interpolating a string,
// which is what lets the Czech put the name where Czech wants it — the translated
// message carries a `<0/>` the translator moves, not a fixed word order.
const SENTENCES = {
  yesterday: (props: WinnerNameProps) => (
    <Trans>
      <WinnerName {...props} /> won yesterday
    </Trans>
  ),
  lastWeek: (props: WinnerNameProps) => (
    <Trans>
      <WinnerName {...props} /> won last week
    </Trans>
  ),
  both: (props: WinnerNameProps) => (
    <Trans>
      <WinnerName {...props} /> won yesterday and last week
    </Trans>
  ),
} as const satisfies Record<WinnerWindow, (props: WinnerNameProps) => ReactNode>

// How long a sentence holds before the other one takes over. Short on purpose: there
// are only ever two of them and each is a handful of words, so a quick alternation
// reads as one line saying two things rather than as two lines taking turns — and a
// player glancing at the board sees both without waiting for one.
const CYCLE_MS = 2000
const FADE_MS = 200

// One line, always — matching the `leading-[15px]` the sentence is set in.
//
// The slot is held open whether or not there is anything to say, and whether or not the
// answer has come back yet. It used to collapse to nothing, on the reasoning that a board
// nobody has won should not hold a blank line between the pills and the leaderboard — but
// the stripe cannot tell "nobody won this board" from "we have not asked yet", and it
// clears itself on every board switch. So it collapsed on load and again on every change
// of mode or difficulty, then sprang back when the answer landed: 23px of the screen
// moving a second or two after it had settled — this line plus the column's own 8px gap,
// measured in the browser as the one layout shift the intro screen had left.
const LINE_HEIGHT = 15

// Who took this board yesterday, and who took it last week — the stripe between the
// difficulty pills and the leaderboard.
//
// It speaks for the selected board, the same one the leaderboard below it shows, and
// the winner's name is drawn in that board's colour — the colour that marks the
// player's own row down there. Pick a board, see who has been taking it lately, then
// see the standings: one column, read top to bottom.
export function RecentWinners({
  gameMode,
  difficulty,
}: {
  gameMode: Mode
  difficulty: Difficulty
}) {
  const lines = useRecentWinners(gameMode, difficulty)
  const champions = useChampionsContext()
  const [index, setIndex] = useState(0)
  const fade = useSharedValue(0)
  const count = lines.length

  // Starts hidden and fades in when the answer lands, so the sentence arrives rather
  // than popping in under the difficulty pills. A board switch runs the same path:
  // `useRecentWinners` clears its winners the moment the board changes, which drops
  // this back to nothing until the new board's answer comes in and fades up.
  useEffect(() => {
    setIndex(0)
    fade.value = withTiming(count === 0 ? 0 : 1, {
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [gameMode, difficulty, count, fade])

  // Only ever two sentences, and only when two different players won the two windows —
  // one player who took both says so in a single line that has nothing to cycle with.
  useEffect(() => {
    if (count < 2) return
    // Swapped at the trough rather than cross-faded: one Text means the slot never has
    // to hold both sentences at once.
    const enter = () => {
      setIndex((current) => (current + 1) % count)
      fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad) })
    }
    const onFaded = (finished?: boolean) => {
      'worklet'
      if (finished === true) scheduleOnRN(enter)
    }
    const advance = () => {
      fade.value = withTiming(
        0,
        { duration: FADE_MS, easing: Easing.in(Easing.quad) },
        onFaded,
      )
    }
    const id = setInterval(advance, CYCLE_MS)
    return () => {
      clearInterval(id)
    }
  }, [count, fade])

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))

  // The index survives a shrinking list — two sentences becoming one while the second
  // is showing would otherwise leave nothing on screen.
  const line = lines[index] ?? lines[0]

  return (
    <View className="w-full max-w-3xs self-center" style={{ height: LINE_HEIGHT }}>
      {line !== undefined && (
        <Animated.View style={fadeStyle}>
          {/* One line rather than two: the slot above is one line, and a sentence that
              wrapped would grow past it — the same jump by another route. Only a long
              nickname on the longest of the three sentences comes close, and an aside
              that trails off reads better than a board that hops. */}
          <Text
            selectable={false}
            numberOfLines={1}
            className="text-center font-mono text-[10px] leading-[15px] text-dim"
          >
            {SENTENCES[line.window]({
              userId: line.winner.userId,
              nickname: line.winner.nickname,
              mark: championMark(line.winner.userId, champions),
              avgAccuracy: line.winner.avgAccuracy,
              avgSpeed: line.winner.avgSpeed,
            })}
          </Text>
        </Animated.View>
      )}
    </View>
  )
}

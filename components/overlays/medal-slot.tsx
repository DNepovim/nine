import { isEmptyArray, isNonEmptyArray } from 'narrowland'
import { useCallback, useEffect, useState } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { LostMedalLine } from '@/components/overlays/lost-medal-line'
import { MedalLine } from '@/components/overlays/medal-line'
import type { LostMedalNews } from '@/hooks/use-lost-medals'
import type { Medal } from '@/lib/medals'

const FADE_MS = 320

// One piece of news gets a beat to itself. A run of them has to keep moving — a night
// that cost three boards would otherwise hold this line for ten seconds in front of a
// player who opened the app to press PLAY — but not so fast that a name goes past
// unread, which is the whole reason the name is there.
const holdFor = (count: number): number => (count === 1 ? 3400 : 2100)

// The one line under the title, and what stands in it.
//
// News of the medals a rival took goes here rather than into a banner of its own, because
// this is the line that says what the player holds — and the point being made is that
// they hold fewer. It covers the medals rather than sitting beside them, says its piece
// one loss at a time, then fades and hands the space back, so the screen settles into the
// truth on its own.
//
// Both lines are set to the same 13px leading, so no swap changes the height. The one
// shift left is the slot closing on a player whose only medals were the ones taken —
// which is the screen arriving where it belongs, a beat later.
export function MedalSlot({
  medals,
  news,
  onNewsSeen,
}: {
  medals: readonly Medal[]
  // The medals taken while the app was closed and who has them now, biggest claim first.
  // Empty when nothing was taken.
  news: readonly LostMedalNews[]
  // Fired once the whole sequence has been shown, so it is not delivered twice. This slot
  // unmounts for the whole run and the news outlives it — without this, the same medals
  // would be taken from the player again at the end of every run.
  onNewsSeen: () => void
}) {
  // The sequence being played, frozen when it starts. Copied out of the prop rather than
  // read from it, so the parent clearing the news at the end cannot pull the lines out
  // from under the fade that is still finishing.
  const [showing, setShowing] = useState<readonly LostMedalNews[]>([])
  const [index, setIndex] = useState(0)
  const fade = useSharedValue(1)

  const begin = useCallback((items: readonly LostMedalNews[]) => {
    setShowing(items)
    setIndex(0)
  }, [])

  const next = useCallback(() => {
    setIndex((shown) => shown + 1)
  }, [])

  // The medals are standing here when the news arrives, so they are shown out before it
  // is shown in — a slot that cut straight from a medal line to a grey one would read as
  // a glitch rather than as one replacing the other.
  useEffect(() => {
    if (isEmptyArray(news) || isNonEmptyArray(showing)) return
    fade.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished === true) scheduleOnRN(begin, news)
      },
    )
  }, [news, showing, begin, fade])

  // Each loss in turn: in, held, out, and the next one takes its place. Keyed on the
  // index so every line runs the same way, including the first.
  useEffect(() => {
    if (showing[index] === undefined) return
    fade.value = withSequence(
      withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.ease) }),
      withDelay(
        holdFor(showing.length),
        withTiming(
          0,
          { duration: FADE_MS, easing: Easing.in(Easing.ease) },
          (finished) => {
            // An interrupted fade has been taken over by something else; only the one
            // that ran to the end has earned the right to move the sequence on.
            if (finished === true) scheduleOnRN(next)
          },
        ),
      ),
    )
  }, [showing, index, next, fade])

  // Past the last one. The medals come back, and the news is spent so it is not told again
  // after the next run.
  useEffect(() => {
    if (isEmptyArray(showing) || index < showing.length) return
    onNewsSeen()
    fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.ease) })
  }, [showing, index, onNewsSeen, fade])

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))

  const current = showing[index]

  // Silent on a fresh install, so the title keeps its space — the emptiness is checked
  // out here rather than left to MedalLine's own null because the margin belongs to this
  // slot, and a margin around nothing would open a gap on exactly that install.
  if (current === undefined && isEmptyArray(medals)) return null

  return (
    <Animated.View className="mb-4" style={fadeStyle}>
      {current === undefined ? (
        <MedalLine medals={medals} />
      ) : (
        <LostMedalLine
          mode={current.loss.mode}
          difficulty={current.loss.difficulty}
          period={current.loss.period}
          rank={current.loss.had}
          taker={current.taker}
        />
      )}
    </Animated.View>
  )
}

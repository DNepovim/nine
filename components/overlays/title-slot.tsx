import { isEmptyArray, isNonEmptyArray } from 'narrowland'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
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

// How long each of the two standing faces holds before the other takes over. Slower
// than the winners stripe above the leaderboard, which has a sentence to read: these
// are two glyph-and-code lines, and a player who has just opened the app should get a
// beat to take one in rather than watching the line flicker.
const CYCLE_MS = 3600

// Both faces are set to the same 13px leading, and the slot states its own height so a
// swap can never move the title above it or the pills below.
const SLOT_HEIGHT = 16

// One piece of news gets a beat to itself. A run of them has to keep moving — a night
// that cost three boards would otherwise hold this line for ten seconds in front of a
// player who opened the app to press PLAY — but not so fast that a name goes past
// unread, which is the whole reason the name is there.
const holdFor = (count: number): number => (count === 1 ? 3400 : 2100)

// The one line under the title, and what stands in it.
//
// Three things want this line and the screen has room for one, so they take turns in it.
// Two of them alternate on a cycle: what the player holds across the boards, and the last
// thing they achieved. They are the same shape of statement — a glyph and a few
// characters saying what you have done — so a line that says one and then the other reads
// as one line rather than as two rows stacked, which is the whole point: the intro screen
// was paying two lines' height for it.
//
// The third is news, and it does not take turns. The medals a rival took while the app was
// closed cover the slot entirely until they have been said, because this is the line that
// says what the player holds and the point being made is that they hold fewer. It says its
// piece one loss at a time, then fades and hands the slot back to the cycle, so the screen
// settles into the truth on its own.
//
// The one shift left is the slot closing on a player with neither medals nor a loaded
// achievement line — which is the screen arriving where it belongs, a beat later.
export function TitleSlot({
  medals,
  news,
  onNewsSeen,
  onPressMedals,
  achievements,
}: {
  medals: readonly Medal[]
  // The medals taken while the app was closed and who has them now, biggest claim first.
  // Empty when nothing was taken.
  news: readonly LostMedalNews[]
  // Fired once the whole sequence has been shown, so it is not delivered twice. This slot
  // unmounts for the whole run and the news outlives it — without this, the same medals
  // would be taken from the player again at the end of every run.
  onNewsSeen: () => void
  // Opens the full list behind the medal line — every medal rather than one per mode,
  // and the week's losses with the names that took them.
  onPressMedals: () => void
  // The achievement line, or null while the device's copy is still being read — the slot
  // takes it as a node rather than as counts of its own, so what stands in this line and
  // what that line says stay separate questions.
  achievements: ReactNode | null
}) {
  // The sequence being played, frozen when it starts. Copied out of the prop rather than
  // read from it, so the parent clearing the news at the end cannot pull the lines out
  // from under the fade that is still finishing.
  const [showing, setShowing] = useState<readonly LostMedalNews[]>([])
  const [index, setIndex] = useState(0)
  const [face, setFace] = useState(0)
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

  // Past the last one. The cycle comes back, and the news is spent so it is not told
  // again after the next run.
  useEffect(() => {
    if (isEmptyArray(showing) || index < showing.length) return
    onNewsSeen()
    fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.ease) })
  }, [showing, index, onNewsSeen, fade])

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))

  const current = showing[index]
  // What the cycle has to work with. A player with no medals yet has one face and the
  // line simply holds it; the achievement line is null only until the device's copy is
  // read, and after that it is always there — see AchievementProgress on why it is never
  // silent.
  const faces: readonly ReactNode[] = [
    ...(isNonEmptyArray(medals)
      ? [<MedalLine key="medals" medals={medals} onPress={onPressMedals} />]
      : []),
    ...(achievements === null ? [] : [achievements]),
  ]
  const count = faces.length

  // Swapped at the trough rather than cross-faded: one face at a time means the slot
  // never has to hold both, and the two are different widths.
  //
  // Held off while there is news to tell — the sequence above owns the same `fade`, and
  // two things driving one opacity is the line blinking out mid-sentence. The gate is
  // the news itself rather than `showing`, which stays full after the sequence ends.
  useEffect(() => {
    if (count < 2 || isNonEmptyArray(news) || current !== undefined) return
    const enter = () => {
      setFace((shown) => (shown + 1) % count)
      fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.ease) })
    }
    const onFaded = (finished?: boolean) => {
      'worklet'
      if (finished === true) scheduleOnRN(enter)
    }
    const id = setInterval(() => {
      fade.value = withTiming(
        0,
        { duration: FADE_MS, easing: Easing.in(Easing.ease) },
        onFaded,
      )
    }, CYCLE_MS)
    return () => {
      clearInterval(id)
    }
  }, [count, news, current, fade])

  // The index survives a shrinking list — the achievement line landing after the medals
  // have already started cycling, or a player whose only medals were the ones just taken.
  const standing = faces[face] ?? faces[0]

  // Silent on a fresh install before anything has loaded, so the title keeps its space —
  // the emptiness is checked out here rather than left to each face's own null because
  // the height and the margin belong to this slot, and either around nothing would open a
  // gap on exactly that install.
  if (current === undefined && standing === undefined) return null

  return (
    <Animated.View
      className="mb-3 items-center justify-center"
      style={[fadeStyle, { height: SLOT_HEIGHT }]}
    >
      {current === undefined ? (
        standing
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

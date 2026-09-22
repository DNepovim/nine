import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { AchievementRow } from '@/components/overlays/achievement-row'
import { PageDots } from '@/components/page-dots'
import type { AchievementId } from '@/constants/achievements'
import { ACHIEVEMENT_SCALE } from '@/constants/colors'
import { firstEarnedAt, stagesOf, type AchievementStore } from '@/lib/achievement-store'
import { boardMarks, stageProgress, type AchievementFacts } from '@/lib/achievements'

// The what's-new dialog's edge, in the achievement green rather than the spectrum: this
// card belongs to one achievement, and green is what the app says that with everywhere
// else. The gradient is a padded backdrop with the card on top of it, which is how a
// gradient border is done without `borderImage` — unsupported in React Native.
const BORDER = 2
const RADIUS = 20

const ENTER_MS = 140
const EXIT_MS = 160

// How long after the last scroll event a swipe counts as landed. The same settle the
// board's period tabs use: `onMomentumScrollEnd` is not to be relied on across platforms,
// and rounding the offset once the events stop is.
const SETTLE_MS = 80

// One achievement in full, for a chip on the game over screen that says only its name:
// its emblem, what it asked of you, and how far along each stage is.
//
// A run that earned several is the common case on a good run, and a card that opened on
// the one chip you tapped and then had to be dismissed to read the next one was making
// the player go back out to the row three times. So the card is one page of a slider over
// everything the run earned — swipe, or tap a dot — opened on the chip that was actually
// pressed.
//
// The list's own row, lifted into a card rather than rebuilt — the achievements screen
// already answers exactly these questions about one achievement, and a second layout
// saying the same things is a second thing to keep in step with the rules.
//
// Any tap closes it, the card included. This is something to read rather than a dialog:
// there is nothing in here to act on, so an X to aim at would be a control standing
// between the player and the run they are trying to get back to. The dots are the one
// exception — a tap on one is answered by the dot rather than by the backdrop, because a
// responder is never shared.
export function AchievementDetail({
  ids,
  start,
  store,
  facts,
  onDismiss,
}: {
  // Every achievement this run earned, in the order the chips read. One page each: two
  // stages of the same achievement are one card, since the card is about the achievement
  // rather than about the stage.
  ids: readonly AchievementId[]
  // Which of them the player actually tapped. The slider opens there.
  start: number
  store: AchievementStore
  // What the rules measure against, so the bars can show how far along the stages this
  // run did not finish are. The same object the run itself was judged with.
  facts: AchievementFacts
  onDismiss: () => void
}) {
  const fade = useSharedValue(0)
  const scale = useSharedValue(0.92)
  // The page width, which is the modal's own rather than the window's: on the web build
  // the app lives inside a phone frame, and a page sized to the desk would scroll past
  // the card it holds.
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(start)
  const scrollRef = useRef<ScrollView>(null)
  // The page the slider is on, for the placing effect below to read without becoming a
  // dependency of it — otherwise every swipe would re-place the scroll it came from.
  const pageRef = useRef(start)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    fade.value = withTiming(1, { duration: ENTER_MS })
    scale.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.quad) })
  }, [fade, scale])

  // Opens on the chip that was tapped rather than at the beginning, and lands back on
  // the same page if the width changes under it — a rotation would otherwise leave the
  // slider stopped between two cards.
  useEffect(() => {
    if (width === 0) return
    scrollRef.current?.scrollTo({ x: pageRef.current * width, animated: false })
  }, [width])

  useEffect(
    () => () => {
      clearTimeout(settleTimer.current)
    },
    [],
  )

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }))
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  // Shrinks away rather than blinking out. `onDismiss` unmounts this, so it has to wait
  // for the animation to land.
  const close = () => {
    fade.value = withTiming(0, { duration: EXIT_MS })
    scale.value = withTiming(
      0.92,
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet'
        if (finished === true) scheduleOnRN(onDismiss)
      },
    )
  }

  const goTo = (index: number) => {
    pageRef.current = index
    setPage(index)
    scrollRef.current?.scrollTo({ x: index * width, animated: true })
  }

  return (
    // `transparent` so the game over screen stays visible under the scrim, and
    // `onRequestClose` so Android's back button closes this rather than the run.
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Pressable className="flex-1" onPress={close}>
        <Animated.View
          className="flex-1 items-center justify-center"
          style={[{ backgroundColor: 'rgba(10,10,18,0.55)' }, fadeStyle]}
          onLayout={(e) => {
            setWidth(e.nativeEvent.layout.width)
          }}
        >
          {/* Nothing to page until the width is known — a page of zero would put every
              card in the same place and leave the slider with nowhere to go. */}
          {width > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              style={{ flexGrow: 0, width }}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x
                clearTimeout(settleTimer.current)
                settleTimer.current = setTimeout(() => {
                  const index = Math.round(x / width)
                  pageRef.current = index
                  setPage(index)
                }, SETTLE_MS)
              }}
            >
              {ids.map((id) => (
                <Pressable
                  key={id}
                  onPress={close}
                  style={{ width }}
                  className="items-center justify-center px-4"
                >
                  <Animated.View style={[{ width: '90%', maxWidth: 380 }, cardStyle]}>
                    <LinearGradient
                      colors={[...ACHIEVEMENT_SCALE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ borderRadius: RADIUS, padding: BORDER }}
                    >
                      <View
                        className="bg-surface px-5 py-3"
                        style={{ borderRadius: RADIUS - BORDER }}
                      >
                        <AchievementRow
                          id={id}
                          earnedAt={firstEarnedAt(store, id)}
                          stages={stagesOf(store, id)}
                          progress={stageProgress(id, facts)}
                          boards={boardMarks(id, facts)}
                        />
                      </View>
                    </LinearGradient>
                  </Animated.View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Only where there is somewhere to go. One achievement needs no dots, and a
              single dot under a card would read as a control that does nothing. */}
          {ids.length > 1 && (
            <View className="mt-3">
              <PageDots
                total={ids.length}
                current={page}
                color={ACHIEVEMENT_SCALE[0]}
                onSelect={goTo}
              />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

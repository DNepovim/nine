import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { SWIPE_THRESHOLD } from '@/constants/game'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

const ICON_ZONE = 44
const LABEL_ZONE = 90
// How far the rectangle's flush right edge sits past the screen edge, even
// fully revealed — the border never appears, so the tab always reads as
// something sliding out from behind the screen rather than a floating pill.
const BORDER_HIDE = 8
// Clear of both zones, so the very first frame after mounting has nothing on
// screen at all — the slide in from there is what makes it read as arriving
// rather than as having been there all along.
const OFFSCREEN_X = ICON_ZONE + LABEL_ZONE + 24
const ENTER_MS = 320
const SLIDE_MS = 220

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 6,
  elevation: 4,
}

// The icon's attention-getter while the label is out: a quick wiggle, then a long
// hold, on repeat — enough to catch the eye without nagging at it. Not the same
// signal as the slide in; this is "notice me", the slide is "here I am".
const SHAKE_DEG = 8
const SHAKE_PAUSE_MS = 2200

// The door to the feedback overlay: a rounded-left tab pinned to the bottom-right
// edge, there on every screen except a live run — a dial mid-run has no room for a
// tab a thumb could graze. Icon and border wear the current mode's colour so it
// still reads as part of the game rather than as chrome.
//
// Ordinarily only the icon end is on screen — the "TELL US" label sits past the
// edge. `revealed` is the caller's call: paused and game over bring it fully into
// view on their own, and a rightward swipe over it asks the caller (`onCollapse`)
// to send it back. Controlled rather than owning the flag itself, because this
// component unmounts while the feedback overlay is open — an internal flag would
// forget a collapse the moment the player closed that dialog.
//
// Every mount slides in from off screen to wherever it's landing — collapsed on
// most screens, fully revealed on paused and post-cinematic game over — rather
// than simply appearing there. Later toggles between collapsed and revealed (a
// swipe, or paused catching up a beat after mount) are the shorter, plainer slide.
export function FeedbackBookmark({
  mode,
  revealed,
  onCollapse,
  onPress,
}: {
  mode: Mode
  revealed: boolean
  onCollapse: () => void
  onPress: () => void
}) {
  const color = MODE_GRADIENT[mode][0]
  const translateX = useSharedValue(OFFSCREEN_X)
  const shake = useSharedValue(0)
  const mounting = useRef(true)

  useEffect(() => {
    const entering = mounting.current
    mounting.current = false
    translateX.value = withTiming(revealed ? BORDER_HIDE : LABEL_ZONE, {
      duration: entering ? ENTER_MS : SLIDE_MS,
      easing: entering
        ? Easing.out(Easing.cubic)
        : revealed
          ? Easing.out(Easing.quad)
          : Easing.in(Easing.quad),
    })
  }, [translateX, revealed])

  useEffect(() => {
    if (!revealed) {
      shake.value = withTiming(0, { duration: 120 })
      return
    }
    shake.value = withRepeat(
      withSequence(
        withTiming(SHAKE_DEG, { duration: 70, easing: Easing.inOut(Easing.quad) }),
        withTiming(-SHAKE_DEG, { duration: 140, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 70, easing: Easing.inOut(Easing.quad) }),
        withDelay(SHAKE_PAUSE_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
    )
  }, [shake, revealed])

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onEnd((e) => {
      'worklet'
      if (revealed && e.translationX > SWIPE_THRESHOLD) {
        scheduleOnRN(onCollapse)
      } else if (
        Math.abs(e.translationX) < SWIPE_THRESHOLD &&
        Math.abs(e.translationY) < SWIPE_THRESHOLD
      ) {
        scheduleOnRN(onPress)
      }
    })

  const rectStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value}deg` }],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        className="absolute bottom-16 right-0 flex-row items-center rounded-l-2xl border border-r-0"
        style={[
          { borderColor: color, backgroundColor: '#FFFFFF', height: ICON_ZONE },
          SHADOW,
          rectStyle,
        ]}
      >
        <Animated.View
          className="items-center justify-center"
          style={[{ width: ICON_ZONE }, iconStyle]}
        >
          <Ionicons name="chatbox-outline" size={20} color={color} />
        </Animated.View>
        <View className="justify-center pr-4" style={{ width: LABEL_ZONE }}>
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[10px] font-bold tracking-[1.5px]"
            style={{ color }}
          >
            TELL US
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

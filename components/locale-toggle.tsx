import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { LOCALES, type Locale } from '@/lib/i18n/locale'

const TOGGLE_H = 30
const PAD = 4
const SEGMENT_W = 36
// The segments tile the track exactly, so a label's centre is the centre of its share
// of the width. The knob is inset within that share rather than added to it — padding
// the track instead would shift the knob by PAD and leave the labels where they were,
// which is how they came to sit off-centre inside it.
const TOGGLE_W = SEGMENT_W * LOCALES.length
const KNOB_W = SEGMENT_W - PAD * 2
const KNOB_H = TOGGLE_H - PAD * 2

// The same swing the theme toggle uses, so the two controls in this row move alike
// rather than each having its own idea of how a pill behaves.
const SWING_MS = 280
const SWING_EASING = Easing.inOut(Easing.sin)

// The tag each locale wears, in its own language. A player who has landed in a
// language they cannot read still has to find their way out, and a translated pair
// would leave both labels in the language they are trying to leave.
const LABEL: Record<Locale, string> = {
  en: 'EN',
  cs: 'CS',
}

// Two named choices rather than the theme's on-or-off, but the same mechanism: a knob
// that slides under fixed labels. Language and theme sit in adjacent rows of the
// options screen and are the same kind of decision, so they should not look like two
// different species of control.
//
// The knob is `elevated` and the label on it `primary`, which is the one pairing that
// inverts with the theme — near-white under near-black ink in light, near-black under
// near-light ink in dark. The obvious-looking `strong` is a trap here: it is the
// primary *button* background, and in the light theme it is the same hex as `primary`,
// so an active label drawn that way is invisible rather than merely low-contrast.
export function LocaleToggle({
  locale,
  onSelect,
}: {
  locale: Locale
  onSelect: (locale: Locale) => void
}) {
  const index = Math.max(0, LOCALES.indexOf(locale))
  const knobX = useSharedValue(index * SEGMENT_W + PAD)

  useEffect(() => {
    knobX.value = withTiming(index * SEGMENT_W + PAD, {
      duration: SWING_MS,
      easing: SWING_EASING,
    })
  }, [index, knobX])

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }))

  return (
    <View
      className="flex-row items-center self-center bg-card"
      style={{ width: TOGGLE_W, height: TOGGLE_H, borderRadius: TOGGLE_H / 2 }}
    >
      <Animated.View
        className="bg-elevated"
        style={[
          {
            // `left`/`top` pinned rather than left to the row's alignment, so the
            // knob's origin is the track's own edge and translateX is the only thing
            // that moves it.
            position: 'absolute',
            left: 0,
            top: PAD,
            width: KNOB_W,
            height: KNOB_H,
            borderRadius: KNOB_H / 2,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
          },
          knobStyle,
        ]}
      />
      {LOCALES.map((option) => {
        const active = option === locale
        return (
          <Pressable
            key={option}
            onPress={() => {
              onSelect(option)
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{
              width: SEGMENT_W,
              height: TOGGLE_H,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              selectable={false}
              className={`font-mono text-[11px] font-black tracking-[1px] ${
                active ? 'text-primary' : 'text-dim'
              }`}
            >
              {LABEL[option]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

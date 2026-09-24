import { useEffect } from 'react'
import { View, type StyleProp, type TextStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { mono } from '@/constants/theme'
import { GLASS_FAR_PX, GLASS_SHADOW } from '@/lib/glass'

// The splash wordmark: white, as it has always been, with the edge and the shadow that
// say it is a solid thing standing off the gradient rather than a hole cut in it.
//
// White is the whole constraint here, and it rules out half of the glass vocabulary the
// app's other three titles use. There is no lighting a white letter from above — nothing
// is brighter than white — so the lit rim those wear is not available, and neither is a
// pane you can see through: the spectrum coming through the logo is what made an earlier
// attempt at this read as a watermark rather than as the front door. What is left is the
// shaded foot, which is the thickness of the letter catching no light, and the shadow it
// drops.
//
// Drawn as stacked copies of the same glyph, the way `overlays/animated-letter.tsx` draws
// its bands: the foot is a window onto a second copy of the letter, which is the one way
// to give part of a glyph its own colour without a mask.

const CHARS = ['N', 'I', 'N', 'E'] as const

// Each letter drifts on its own clock, and the periods stay coprime-ish so the four never
// line up into a single bob.
const FLOAT_PERIODS = [8000, 9500, 7500, 9000] as const
const FLOAT_RISE = 4

const FONT_SIZE = 80

// Pinned rather than left to the font, because the foot below is placed down this box in
// pixels: a line box that differed between web and native would put the shade across the
// bottom of the letter on one and across the middle of it on the other.
const LINE_HEIGHT = 92

// Where the capitals end in that box, measured off the rendered wordmark rather than
// derived from the font, and how far past them the shade is drawn.
//
// Only the top of this window matters: it is what decides how thick the shade reads. The
// overshoot below costs nothing — a band is a window onto the glyph, and a window past the
// end of one shows nothing — so a platform whose capitals sit lower than this gets a
// slightly thicker foot rather than none at all, which is the failure worth having.
const CAP_FOOT = 74
const FOOT_OVERSHOOT = 8

// The edge, and the one liberty this takes with a white logo. Black at low alpha rather
// than a grey: grey over a gradient this saturated reads as dirt, where a shade keeps
// whatever hue is behind it and only takes the light out of it.
const FOOT_SHADE = 'rgba(0, 0, 0, 0.22)'

// No letter spacing here, and the gap below carries all of it instead. Each letter is its
// own Text, so spacing could only ever be added *after* the one glyph in it: it widened
// the box, which read as more room between two letters, and left the same 4px hanging off
// the end of the E where there is no next letter to separate. That tail is part of the
// row, so centring the row put the word half of it left of centre.
const GLYPH: StyleProp<TextStyle> = {
  fontFamily: mono,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  fontWeight: '900',
  includeFontPadding: false,
}

function SplashLetter({ char, index }: { char: string; index: number }) {
  const rise = useSharedValue(0)
  const period = FLOAT_PERIODS[index] ?? 8000

  useEffect(() => {
    rise.value = withRepeat(
      withSequence(
        withTiming(-FLOAT_RISE, {
          duration: period / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [])

  // The float lives on the wrapper rather than on either copy: two layers bobbing to
  // their own clocks would come apart.
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }))

  return (
    <Animated.View style={style}>
      {/* The letter, and the shadow it stands on. */}
      <Animated.Text
        selectable={false}
        style={[GLYPH, { color: '#ffffff' }, GLASS_SHADOW]}
      >
        {char}
      </Animated.Text>

      {/* The foot, clipped out of a second copy of it. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          // Past the right of the box for the same reason the window overshoots below:
          // it is free, and a glyph emboldened past its cell keeps its foot either way.
          // The letter spacing used to leave this slack behind; now it is asked for.
          right: -FOOT_OVERSHOOT,
          top: CAP_FOOT - GLASS_FAR_PX,
          height: GLASS_FAR_PX + FOOT_OVERSHOOT,
          overflow: 'hidden',
        }}
      >
        {/* Pulled back up by exactly what the window is pushed down, so the copy lands on
            top of the letter it is a slice of. Absolutely placed rather than pulled with a
            negative margin — a margin on a Text does not move it on the web. */}
        <Animated.Text
          selectable={false}
          style={[
            GLYPH,
            {
              color: FOOT_SHADE,
              position: 'absolute',
              left: 0,
              top: -(CAP_FOOT - GLASS_FAR_PX),
            },
          ]}
        >
          {char}
        </Animated.Text>
      </View>
    </Animated.View>
  )
}

export function SplashWordmark() {
  return (
    <>
      {CHARS.map((char, index) => (
        <SplashLetter key={index} char={char} index={index} />
      ))}
    </>
  )
}

// The whole of the space between two letters: the 12 the row always had, plus the 4 the
// glyphs used to contribute out of their own boxes. Moving it here changes nothing about
// where the letters sit next to each other and everything about where the word sits in
// the screen — the row is now exactly as wide as the ink in it.
export const SPLASH_WORDMARK_GAP = 16

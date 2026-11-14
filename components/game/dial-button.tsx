import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { DialKeyBadges } from '@/components/game/dial-key-badges'
import { DialKeyCoats } from '@/components/game/dial-key-coats'
import { DialPulse } from '@/components/game/dial-pulse'
import { ReelFace } from '@/components/game/reel-face'
import { AZULEJO, DIAL_COLORS, PRIMARY_INK } from '@/constants/colors'
import { DEFAULT_DIAL_CORNERS, type DialCorners } from '@/constants/dial-hints'
import { mono } from '@/constants/theme'
import { useKeyMotion } from '@/hooks/use-key-motion'
import { useKeyTint } from '@/hooks/use-key-tint'
import { useScheme } from '@/hooks/use-scheme'
import { useTileInk } from '@/hooks/use-tile-grid'
import { type DialCommand } from '@/lib/dial-gesture'
import { keySpinDegrees } from '@/lib/key-spin'
import { mixHex } from '@/lib/mix-hex'
import { TOP_LEVEL } from '@/lib/tile-motif'
import type { DialControl } from '@/machines/tutorial-lesson'
import type { DialOrientation } from '@/modes'

// The greys a **sketched** key is filled with where its scheme draws no keys of its own: paper
// at nought, a soft pencil laid on at nine, and the digit in graphite on either.
const SKETCH_GREYS = {
  low: '#EEEDE8',
  high: '#B4B2AC',
  text: PRIMARY_INK,
  peakText: PRIMARY_INK,
} as const

// How close the eye is as a **mirrored** key turns over: near enough to see it swing.
const TURN_PERSPECTIVE = 500

// How a key's flip is drawn, by the dial's orientation: how far the digit is turned, and
// which screen axis the pill's bounce runs along. The flip itself — the digit's lift and
// the bounce — is keyed by the dial's own move, so on a sideways dial both have to be
// turned with the dial or the digit would fly one way and the key jump another.
//
// Only these two. The squash follows the thumb on the screen, and the halo, the shadow and
// the badges belong to screen corners — turn the whole key and all of them turn with it.
const FLIP_FRAME = {
  // Nothing turned and the bounce on its own axis — an upright key carries no transform it
  // does not use.
  upright: { turn: [], bounce: 'y' },
  // A quarter turn counter-clockwise: the digit's lift along its own vertical lands on
  // screen-x, so the bounce goes there too — the dial's up is screen-left.
  sideways: { turn: [{ rotate: '-90deg' }], bounce: 'x' },
} as const satisfies Record<
  DialOrientation,
  { turn: readonly { rotate: string }[]; bounce: 'x' | 'y' }
>

export function DialButton({
  index,
  value,
  size,
  weight,
  digits,
  orientation,
  showSum,
  trainee,
  bigHints = false,
  peakFrom,
  peakTo,
  commands,
  pressed,
  inFlight,
  corners = DEFAULT_DIAL_CORNERS,
  control = 'full',
  hinted = false,
  heat = null,
  scrambles = 0,
  dark = false,
  mirrored = false,
  sketched = false,
  digitSize = 30,
  sweep = null,
  sweepAt = 0,
  onDelta,
  onSet,
}: {
  // Where this key sits in the dial, which is the only name the pan above knows it by.
  index: number
  value: number
  size: number
  weight: number
  // How many values the key takes, counted from zero: 10 is the digits 0–9.
  digits: number
  // Which way up the dial is drawn — see `FLIP_FRAME`.
  orientation: DialOrientation
  showSum: boolean
  trainee: boolean
  // Whether the corner numbers are the lesson or a reference — see the two sets of badge
  // sizes above. Ignored, like `corners`, wherever `trainee` draws no badges at all.
  bigHints?: boolean
  // The mode's dark CTA gradient, worn by the button at its maximum value.
  peakFrom: string
  peakTo: string
  // What the dial's pan has done to each key, and which key is under the thumb. Both are
  // written on the UI thread by the one gesture that spans all nine — see
  // components/game/dial.tsx — so a key reacts in the frame the finger leaves it rather
  // than a render later.
  commands: SharedValue<readonly DialCommand[]>
  pressed: SharedValue<number>
  // How many changes the dial has decided but not yet sent. Counted up there as a key is
  // told, counted down here as the key sends it, so the pan knows when its copy of the
  // grid has stopped running ahead of the one on screen.
  inFlight: SharedValue<number>
  // Which number rides each corner, for a trainee layout — see constants/dial-hints.ts.
  // Read from the player's own options in the game and left at the defaults everywhere
  // else. Ignored entirely when `trainee` is false, which has no badges at all.
  corners?: DialCorners
  // What this key will take. `full` in the game; the tutorial's guided route is the only
  // thing that ever narrows it — see machines/tutorial-lesson.ts.
  control?: DialControl
  // The key the tutorial is asking for, wearing the halo that says so. Separate from
  // `control` because they are different statements: one is what the key will accept, the
  // other is what the player is being pointed at.
  hinted?: boolean
  // How hot the dial is burning, nought to one — the `flame` shot. The key warms to fire
  // colours with it and cools back to its own. Null for every mode whose shot is not a
  // flame.
  heat?: SharedValue<number> | null
  // How many times a hit has **scrambled** the dial this run — see `Dial`. A change of
  // value that arrives with a new count is the dial moving on its own rather than a press,
  // and this key flips its new digit in. Nought on every dial that holds still.
  scrambles?: number
  // Whether the dial is **blacked out** — see `DialSpec.blackout`. The key is drawn flat
  // black with no digit, tint or peak on it, so nothing on it says where it stands; the
  // press, the bounce and the flight still run, unseen, so the timing of a press is the
  // same as on any other dial.
  dark?: boolean
  // Whether the key stands turned round its upright, which draws its digit back to front, as
  // in a mirror — see `DialSpec.mirror`. It gets there as an opening's edge reaches it: `sweep`
  // is how far the edge has come and `sweepAt` where this key stands. With no `sweep` it
  // simply stands turned.
  mirrored?: boolean
  // Whether the key is a part of a pencil drawing — a **proportional** dial's. It fills the
  // box it is put in instead of being a `size` square, since that box is cut to the key and
  // changes as the dial does; and it has no corners, no shadow and no gradient at nine: the
  // lines round it are the dial's, and what it adds is a grey that deepens with its digit, a
  // digit in graphite and a shading under a thumb. `size` is then only what the things measured against a key's size (the
  // badges, the reel) are drawn for.
  sketched?: boolean
  // How big the digit is drawn, where a dial wants it other than the nine's: a dial of one key
  // has the whole of the room to itself, and a digit that small would be lost on it.
  digitSize?: number
  sweep?: SharedValue<number> | null
  sweepAt?: number
  onDelta: (delta: 1 | -1, sweep: boolean) => void
  onSet: (value: number, sweep: boolean) => void
}) {
  // The scheme may draw the keys its own way — `dos` inverts them — and the rim is what
  // keeps a key that matches its ground visible as a key.
  const { keyRim, keys } = useScheme().inks
  const tileInk = useTileInk()
  const tiled = keys !== null && 'tile' in keys && keys.tile
  // A tile is glaze painted in the challenge's own colour, and filled with it at its top.
  const palette = tiled
    ? { low: AZULEJO.glaze, high: AZULEJO.glaze, text: tileInk, peakText: AZULEJO.glaze }
    : (keys ?? (sketched ? SKETCH_GREYS : DIAL_COLORS))
  const peak = tiled ? [tileInk, tileInk] : (keys?.peak ?? [peakFrom, peakTo])
  const rimmed = dark || keys !== null
  const keyRadius = sketched ? 0 : (keys?.radius ?? 999)
  const reel = keys !== null && 'reel' in keys && keys.reel
  const frame = FLIP_FRAME[orientation]
  const top = digits - 1
  // How much of its pattern a tile carries: the digit it shows, spread over the levels.
  const tileLevel = Math.round((value / Math.max(1, top)) * TOP_LEVEL)
  const { rampProgress, peakProgress, live } = useKeyTint({ value, top, control })

  const { scale, bounce, numTranslateY, numOpacity, numScale, reelSpin, reelStrip } =
    useKeyMotion({
      index,
      value,
      digits,
      scrambles,
      reel,
      commands,
      pressed,
      inFlight,
      onDelta,
      onSet,
    })

  const btnStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      frame.bounce === 'x' ? { translateX: bounce.value } : { translateY: bounce.value },
    ],
    backgroundColor: dark
      ? PRIMARY_INK
      : interpolateColor(rampProgress.value, [0, 1], [palette.low, palette.high]),
  }))

  const liveStyle = useAnimatedStyle(() => ({ opacity: live.value }))

  const turnStyle = useAnimatedStyle(() =>
    mirrored
      ? {
          transform: [
            { perspective: TURN_PERSPECTIVE },
            { rotateY: `${keySpinDegrees(sweep?.value ?? 1, sweepAt)}deg` },
          ],
        }
      : // Turned back rather than left out: an animated style that drops a property leaves
        // the last value on the view, so a key that was mirrored would stay so.
        { transform: [{ perspective: TURN_PERSPECTIVE }, { rotateY: '0deg' }] },
  )

  const numStyle = useAnimatedStyle(() => ({
    // Turned before it lifts, so the lift runs along the turned digit's own vertical.
    transform: [
      ...frame.turn,
      { translateY: numTranslateY.value },
      { scale: numScale.value },
    ],
    opacity: numOpacity.value,
  }))

  // The digit warms to pale red over the dark 9 gradient.
  const digitStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      peakProgress.value,
      [0, 1],
      [palette.text, sketched ? palette.text : palette.peakText],
    ),
  }))

  return (
    // Explicit pixel size (not w-1/3 + aspect-square): iOS WebKit fails to derive height
    // from aspect-ratio on wrapping flex children. The two badges below are positioned
    // against this box, not the pill inside it, so they can straddle the pill's rim
    // rather than being clipped by it.
    //
    // No gesture of its own: nine separate pans could each only ever hear the key the
    // finger landed on, and a drag across the dial has to be heard by all of them. The
    // one pan that is lives on the square above — components/game/dial.tsx.
    <Animated.View
      style={[
        sketched ? { flex: 1 } : { width: size, height: size },
        liveStyle,
        turnStyle,
      ]}
    >
      {/* Outside the pill, so it is drawn over the surface between keys rather than
            over a fill this blue would disappear into. */}
      {hinted && <DialPulse />}
      <Animated.View
        style={[
          {
            flex: 1,
            borderRadius: keyRadius,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            shadowColor: '#1C1928',
            shadowOpacity: 0.13,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 10,
            // A black key on a dark screen is no key at all: the scheme's rim draws its
            // edge. Transparent on day, where a black key stands out on its own.
            ...(rimmed && { borderWidth: 1.5, borderColor: keyRim }),
            // The shadow is a third colour on a scheme that draws its own keys.
            ...(keys !== null && { shadowOpacity: 0, borderBottomWidth: keys.foot }),
            ...(tiled && {
              overflow: 'hidden' as const,
              borderWidth: 1,
              borderBottomWidth: 1,
              borderColor: mixHex(tileInk, AZULEJO.glaze, 0.7),
            }),
            ...(sketched && { shadowOpacity: 0, borderWidth: 0, borderBottomWidth: 0 }),
          },
          btnStyle,
        ]}
      >
        <DialKeyCoats
          index={index}
          dark={dark}
          sketched={sketched}
          tiled={tiled}
          keyRadius={keyRadius}
          peak={peak}
          tileLevel={tileLevel}
          tileInk={tileInk}
          peakProgress={peakProgress}
          scale={scale}
          heat={heat}
        />
        {reel && !dark && (
          <ReelFace
            value={value}
            digits={digits}
            size={size}
            radius={keyRadius}
            spin={reelSpin}
            strip={reelStrip}
            scrambles={scrambles}
          />
        )}
        {!dark && !reel && (
          <Animated.Text
            selectable={false}
            style={[
              {
                fontSize: tiled ? Math.round(size * 0.34) : digitSize,
                fontFamily: mono,
                fontWeight: '500' as const,
                includeFontPadding: false,
              },
              digitStyle,
              numStyle,
            ]}
          >
            {showSum ? value * weight : value}
          </Animated.Text>
        )}
      </Animated.View>

      {trainee && (
        <DialKeyBadges
          value={value}
          weight={weight}
          digits={digits}
          size={size}
          bigHints={bigHints}
          corners={corners}
          peakFrom={peakFrom}
          peakTo={peakTo}
          rampProgress={rampProgress}
          peakProgress={peakProgress}
          scale={scale}
        />
      )}
    </Animated.View>
  )
}

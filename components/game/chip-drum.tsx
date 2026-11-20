import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { fontSizeForDigits } from '@/components/game/pie-countdown'
import { CASINO_CHIP } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'

// A chip's **drum**: its number as the digits of a slot machine, each a drum of its own that spins
// and comes to rest on its figure, left to right. It turns when the chip arrives and again when it
// is hit, drawn over the card on a disc of the chip's own red that covers the number beneath. A
// drum is a cylinder, not a strip: the numbers above and below the one in front turn away, so
// they are squashed, dimmed and drawn in closer to it the further they are round.

// What the drum is doing: `rest` for a chip put back mid-clock, which has had its arrival, `arrive`
// and `hit`.
export type DrumRound = 'rest' | 'arrive' | 'hit'

const SPIN_MS = 260
const STAGGER_MS = 70
// How long the cover takes to go once the drums have stopped: briefly for an arrival, which hands
// the number back, and as long as the card takes to leave for a hit.
const HAND_BACK_MS = 120
const HIT_FADE_MS = 160

// How many other numbers go by before one stops on its own figure, and how far round the drum one
// place is, in radians — which also sets how far apart the places are drawn.
const GONE_BY = 4
const STEP = 0.8

// How far in from the edge the covering disc is kept, so the rim, arc and notches stay on show.
const COVER_INSET = 9

// The figures that go by on drum `at` before it stops on `digit`: never that figure, the same ones
// for the same target.
function figures(digit: string, at: number, seq: number): string[] {
  const own = Number(digit)
  return Array.from({ length: GONE_BY + 2 }, (_, place) =>
    place === GONE_BY ? digit : String((own + 1 + ((at * 3 + place * 7 + seq) % 9)) % 10),
  )
}

// One figure on the drum's side: where it stands at `d` places from the front, in turn `a`.
function Place({
  figure,
  place,
  turn,
  row,
  fontSize,
}: {
  figure: string
  place: number
  turn: SharedValue<number>
  row: number
  fontSize: number
}) {
  const style = useAnimatedStyle(() => {
    const angle = (place - turn.value) * STEP
    const face = Math.cos(angle)
    return {
      opacity: face > 0 ? face ** 3 : 0,
      transform: [
        { translateY: (Math.sin(angle) * row) / STEP },
        { scaleY: Math.max(0.05, face) },
      ],
    }
  })
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, height: row },
        { alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Animated.Text
        selectable={false}
        className="font-mono font-extrabold"
        style={{ color: CASINO_CHIP.ink, fontSize, includeFontPadding: false }}
      >
        {figure}
      </Animated.Text>
    </Animated.View>
  )
}

function Drum({
  digit,
  at,
  seq,
  round,
  row,
  width,
  fontSize,
}: {
  digit: string
  at: number
  seq: number
  round: DrumRound
  row: number
  width: number
  fontSize: number
}) {
  const turn = useSharedValue(round === 'rest' ? GONE_BY : 0)
  useEffect(() => {
    if (round === 'rest') return
    turn.value = 0
    // Past the stop and back, so the drum is seen to catch.
    turn.value = withDelay(
      at * STAGGER_MS,
      withTiming(GONE_BY, { duration: SPIN_MS, easing: Easing.out(Easing.back(1.6)) }),
    )
  }, [round])
  return (
    <View style={{ width, height: row * 2.2, justifyContent: 'center' }}>
      <View style={{ height: row }}>
        {figures(digit, at, seq).map((figure, place) => (
          <Place
            key={place}
            figure={figure}
            place={place}
            turn={turn}
            row={row}
            fontSize={fontSize}
          />
        ))}
      </View>
    </View>
  )
}

export function ChipDrum({
  value,
  seq,
  size,
  round,
}: {
  value: number
  seq: number
  size: number
  round: DrumRound
}) {
  const digits = String(value).split('')
  const fontSize = fontSizeForDigits(value, size / PIE_SIZE)
  const row = Math.round(fontSize * 1.1)
  const cover = size - 2 * COVER_INSET
  const spun = (digits.length - 1) * STAGGER_MS + SPIN_MS
  const shown = useSharedValue(round === 'arrive' ? 1 : 0)

  useEffect(() => {
    if (round === 'rest') return
    if (round === 'hit') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
    }
    shown.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(
        spun,
        withTiming(0, { duration: round === 'hit' ? HIT_FADE_MS : HAND_BACK_MS }),
      ),
    )
  }, [round])

  const coverStyle = useAnimatedStyle(() => ({ opacity: shown.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: COVER_INSET,
          top: COVER_INSET,
          width: cover,
          height: cover,
          borderRadius: cover / 2,
          overflow: 'hidden',
          backgroundColor: CASINO_CHIP.ground,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
        coverStyle,
      ]}
    >
      {digits.map((digit, at) => (
        <Drum
          key={at}
          digit={digit}
          at={at}
          seq={seq}
          round={round}
          row={row}
          width={Math.round(fontSize * 0.62)}
          fontSize={fontSize}
        />
      ))}
    </Animated.View>
  )
}

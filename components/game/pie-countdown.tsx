import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { APP_BLUE, APP_RED, PIE_INK, TARGET_BAND_TRACK } from '@/constants/colors'
import { GLIMPSE_FADE_MS, PIE_SIZE } from '@/constants/game'
import { GLYPH } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { targetBand } from '@/lib/target-band'
import type { Drift, Heading } from '@/lib/target-drift'
import type { TargetExit } from '@/types/game'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// The arc never covers the whole circle, so a sliver of the band-tinted track shows
// even on a freshly spawned target. Without this the band cue would grow from nothing
// as the clock drains — absent exactly when the target is most worth reading.
const ARC_MAX = 0.9

// How long a target takes to leave, hit or lost. Both exits run on this one clock —
// and the card fades on it too — so the whole thing lands at once, and so a loss is
// never the quicker way off the board.
export const TARGET_EXIT_MS = 500

// The hit: the ring collapses under the number while the number swells out of it.
const HIT_RING_SCALE = 0.35
const HIT_NUMBER_SCALE = 1.7

// The loss: the colours go first — one quick beat in which the whole pie turns red and
// the numeral turns white — and only then is the number pressed flat into it.
const FAIL_COLOR_MS = 100
const FAIL_SQUASH = 0.06

// The mark a drifting target wears, and where it sits: at the very edge of the disc, on
// the side the number is heading — the top for a rising number, the bottom for a falling
// one. Small and pressed to the rim so it clears the digits, which fill the disc's middle
// at two digits; and inside the card's own box, so placing cards never has to know it is
// there. (Hung outside the disc, it was drawn over a neighbour and over the sum row.)
const DRIFT_ARROW = {
  1: { glyph: '▲', place: 'top-[2%]' },
  [-1]: { glyph: '▼', place: 'bottom-[2%]' },
} as const satisfies Record<Heading, { glyph: string; place: string }>

const fontSizeForDigits = (value: number, scale: number): number => {
  const digits = String(value).length
  const base = digits >= 3 ? 36 : digits === 2 ? 50 : 58
  return Math.round(base * scale)
}

export function PieCountdown({
  value,
  maxValue,
  active,
  duration,
  onComplete,
  size = PIE_SIZE,
  backgroundColor,
  exit = null,
  startProgress = 1,
  clocked = true,
  settles = false,
  glimpse = null,
  revealed = false,
  drift = 0,
}: {
  value: number
  // The highest sum the board being played reaches, which is what the band tint is
  // measured against — see `targetBand`.
  maxValue: number
  active: boolean
  duration: number
  onComplete: () => void
  size?: number
  backgroundColor?: string
  // The target is leaving: stop the clock and play the exit it left by.
  exit?: TargetExit | null
  // Where the clock starts, as a fraction of `duration`. Full for every target that
  // spawns while the app is open; less for one put back from storage mid-clock, which
  // has to come back holding what it had left rather than a whole clock over again.
  // Read once, at mount — see lib/target-clock.ts.
  startProgress?: number
  // Whether this target is on a clock at all. False in the tutorial, which takes the
  // countdown off the board entirely: the arcs are not drawn — a full ring that never
  // moves would promise a clock there is none of — so what is left is the band-tinted
  // disc with the number on it, and nothing on it can run out. The exits below are
  // untouched; a target still collapses under its number when it is hit.
  clocked?: boolean
  // Whether this target **stays on the board** once it is taken, rather than leaving it.
  //
  // A **drilled** run is the one that does: its nine are a fixed picture the player is
  // learning, and a card that vanished the moment it was hit would take a ninth of that
  // picture with it every time. So the hit plays and then settles — the number swells
  // out of the disc and comes back to where it was, and the disc itself does not
  // collapse, because on a drill the disc *is* the thing being remembered.
  //
  // The dimming that follows is the card's, not the pie's: see `spent` on `TargetCard`.
  settles?: boolean
  // How long the number is held once the pie is drawn before it fades out, in ms — what
  // is left of the run's **glimpse**, see `glimpseLeft` — or null for a number that never
  // hides. Nought draws the pie already hidden: a card put back mid-clock has had its
  // glimpse.
  //
  // Only the numeral goes. The disc keeps its band tint and the ring keeps running, so
  // the board still says where a target is, roughly how high, and how long it has left.
  glimpse?: number | null
  // The card is on its way out — hit, lost, or swept off by the end of the run. A
  // glimpsed number comes back for it, so however a card goes it shows what it was.
  // Separate from `exit` because the end of a run is not an exit: those cards shrink
  // away without one, and their numbers are owed all the same.
  revealed?: boolean
  // Which way this target's number **drifts**, for the mark that says so — `0` for one that
  // holds still, which draws none. The number itself is `value`, already drifted by the
  // card (see `useDriftedValue`), so the band tint follows it like everything else here.
  drift?: Drift
}) {
  const scale = size / PIE_SIZE
  const radius = size / 4
  const stroke = size / 2
  const circumference = 2 * Math.PI * radius

  const progress = useSharedValue(startProgress) // 1 = full, 0 = empty
  const ringScale = useSharedValue(1)
  const ringOpacity = useSharedValue(1)
  const numberScale = useSharedValue(1)
  const numberSquash = useSharedValue(1)
  // 0 = the clock's own colours, 1 = the red disc a lost target turns into.
  const failColor = useSharedValue(0)
  // The numeral alone, so a glimpse never has to touch the swell, the squash or the
  // colour the exits drive.
  const numberOpacity = useSharedValue(glimpse === 0 ? 0 : 1)
  // What is left of the glimpse, in ms — run down like `progress`, so it stops where it
  // stands when the run pauses and goes on from there.
  const glimpseHeld = useSharedValue(glimpse ?? 0)
  const failed = exit === 'failed'
  // A clock has to be both running and there in the first place.
  const running = active && clocked
  // The multiplayer hit-flash owns the track while it lasts, so the band yields to it.
  const trackColor = backgroundColor ?? TARGET_BAND_TRACK[targetBand(value, maxValue)]

  // One effect for starting, stopping and starting again, because they are the same
  // thing: the clock always runs from wherever the arc currently stands.
  //
  // Going inactive cancels, which leaves `progress` frozen at the fraction of the
  // clock that was left — and cancelling reports `finished: false`, so a target frozen
  // at nothing does not expire. Coming back runs that remainder: the easing is linear,
  // so the time left is exactly the arc left, and a target that was a hair from
  // running out has a hair of clock when the run resumes. That is what makes pausing
  // cost nothing and give nothing.
  useEffect(() => {
    if (!running) {
      cancelAnimation(progress)
      return
    }
    // Read off the render thread rather than inside it — this is an effect, and it is
    // the only place that can know how much clock is left.
    const remaining = duration * progress.value
    progress.value = withTiming(
      0,
      { duration: remaining, easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(onComplete)
      },
    )
  }, [running])

  // The glimpse, run the way the clock is run: down while the card is live, held where it
  // stands while it is not. A pause is the case that asks for it — the glimpse is the one
  // look the player gets, and a pause just after an arrival would otherwise spend it behind
  // the pause screen, where nobody can see anything. Pausing costs nothing and gives
  // nothing, here as on the ring.
  //
  // Keyed on `active` rather than `running`: a glimpse is about the card being on screen,
  // not about whether it has a clock. And nothing is scheduled without one, so a mode
  // that hides no number pays for none of this.
  useEffect(() => {
    if (glimpse === null || glimpse === 0) return
    if (!active) {
      cancelAnimation(glimpseHeld)
      return
    }
    if (glimpseHeld.value <= 0) return
    glimpseHeld.value = withTiming(
      0,
      { duration: glimpseHeld.value, easing: Easing.linear },
      (finished) => {
        if (!finished) return
        numberOpacity.value = withTiming(0, {
          duration: GLIMPSE_FADE_MS,
          easing: Easing.in(Easing.quad),
        })
      },
    )
  }, [active])

  // Whatever was hidden comes back to be seen leaving. The hold is cancelled first, so a
  // card taken inside its glimpse never has a fade land after this and blank it on the
  // way out — and assigning the opacity a new animation replaces one already in flight.
  useEffect(() => {
    if (!revealed || glimpse === null) return
    cancelAnimation(glimpseHeld)
    numberOpacity.value = withTiming(1, {
      duration: GLIMPSE_FADE_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [revealed])

  // The two exits are the same length and opposite in every other way. A hit lets the
  // number out of the ring that was timing it; a loss buries it in one — the clock's
  // colours go, the disc turns red, and the number is pressed flat into it.
  useEffect(() => {
    if (exit === null) return
    if (exit === 'hit') {
      // A card that settles keeps its disc: collapsing it would throw away the one
      // thing a drilled board is read by. A card that leaves collapses as it always
      // has — the ring going in is what makes the number come out.
      if (!settles) {
        ringScale.value = withTiming(HIT_RING_SCALE, {
          duration: TARGET_EXIT_MS,
          easing: Easing.in(Easing.quad),
        })
      }
      numberScale.value = settles
        ? // Out and back, in the same time the leaving card takes to go — so a hit
          // reads as the same beat whether the card stays or not. Held at 1.7 it would
          // be a numeral standing over its neighbours for the rest of the run.
          withSequence(
            withTiming(HIT_NUMBER_SCALE, {
              duration: TARGET_EXIT_MS / 2,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(1, {
              duration: TARGET_EXIT_MS / 2,
              easing: Easing.inOut(Easing.quad),
            }),
          )
        : withTiming(HIT_NUMBER_SCALE, {
            duration: TARGET_EXIT_MS,
            easing: Easing.out(Easing.quad),
          })
      return
    }
    failColor.value = withTiming(1, {
      duration: FAIL_COLOR_MS,
      easing: Easing.out(Easing.quad),
    })
    ringOpacity.value = withTiming(0, {
      duration: TARGET_EXIT_MS,
      easing: Easing.in(Easing.quad),
    })
    numberSquash.value = withTiming(FAIL_SQUASH, {
      duration: TARGET_EXIT_MS,
      easing: Easing.in(Easing.quad),
    })
  }, [exit])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
  }))

  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
    opacity: 1 - progress.value,
  }))

  // The red comes over the pie rather than through it: one disc the exact size of the
  // ring, fading in across the track and both arcs at once, so what is left is a plain
  // red circle however much clock the target had on it.
  const failDiscStyle = useAnimatedStyle(() => ({
    opacity: failColor.value,
  }))

  // Only taken over once the target is lost — until then the `pie` token paints the
  // numeral, so a screen that retints the token still gets its way.
  const numberColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(failColor.value, [0, 1], [PIE_INK, '#FFFFFF']),
  }))

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))

  // Squashed on its own axis rather than through `scale`, so the press reads as the
  // number being flattened where it stands and not as the whole thing shrinking.
  const numberStyle = useAnimatedStyle(() => ({
    opacity: numberOpacity.value,
    transform: [
      { scaleX: numberScale.value },
      { scaleY: numberScale.value * numberSquash.value },
    ],
  }))

  const cx = size / 2
  const cy = size / 2

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={ringStyle}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
          />
          {/* The clock itself, over the band-tinted track: what is left of it in blue,
              what has gone in red. Both are the countdown, so a target with no clock
              draws neither and the track is the whole disc. */}
          {clocked && (
            <>
              <AnimatedCircle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={APP_BLUE}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={circumference}
                animatedProps={animatedProps}
                transform={`rotate(-90, ${cx}, ${cy})`}
              />
              <AnimatedCircle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={APP_RED}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={circumference}
                animatedProps={redProps}
                transform={`rotate(-90, ${cx}, ${cy})`}
              />
            </>
          )}
        </Svg>
        <Animated.View
          className="absolute inset-0 rounded-full"
          style={[{ backgroundColor: APP_RED }, failDiscStyle]}
        />
      </Animated.View>
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={numberStyle}
      >
        <Animated.Text
          selectable={false}
          numberOfLines={1}
          className={cn('font-mono font-extrabold', !failed && 'text-pie')}
          style={[
            { fontSize: fontSizeForDigits(value, scale), includeFontPadding: false },
            failed && numberColorStyle,
          ]}
        >
          {value}
        </Animated.Text>
      </Animated.View>
      {/* Which way a drifting number is going, on the side it is going to: a mark to aim
          by, read before the number has moved at all. */}
      {drift !== 0 && (
        <View
          pointerEvents="none"
          className={cn('absolute inset-x-0 items-center', DRIFT_ARROW[drift].place)}
        >
          <Text selectable={false} className={cn(GLYPH['2xs'], 'text-pie')}>
            {DRIFT_ARROW[drift].glyph}
          </Text>
        </View>
      )}
    </View>
  )
}

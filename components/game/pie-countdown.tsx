import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { APP_BLUE, APP_RED, PIE_INK, TARGET_BAND_TRACK } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'
import { usePieExit } from '@/hooks/use-pie-exit'
import { usePieGlimpse } from '@/hooks/use-pie-glimpse'
import { useScheme } from '@/hooks/use-scheme'
import { cn } from '@/lib/cn'
import { targetBand } from '@/lib/target-band'
import type { TargetExit } from '@/types/game'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// How thick the clock's arc is under a monochrome scheme.
const THIN_STROKE = 4

// A **drawn** disc: a circle ruled in pencil and coloured in. How thick its clock's arc is, how
// far inside the card the circle is kept so the pencil is not cut at the edge, and the second,
// fainter stroke laid beside the first that makes a ruled line read as pencil.
const DRAWN_STROKE = 3.5
const DRAWN_INSET = 3
const DRAWN_GHOST = { offset: 0.9, opacity: 0.4 } as const

// The arc never covers the whole circle, so a sliver of the band-tinted track shows
// even on a freshly spawned target. Without this the band cue would grow from nothing
// as the clock drains — absent exactly when the target is most worth reading.
const ARC_MAX = 0.9

// What the disc is inked in: an orb's own colours where it has them, the scheme's where it is
// monochrome, and none where it is the ordinary band-tinted disc.
const discInks = (
  orb: { ground: string; rim: string; charge: string } | undefined,
  mono: string | null,
  ground: string,
) => ({
  thin: mono !== null || orb !== undefined,
  discInk: orb?.charge ?? mono,
  discGround: orb?.ground ?? ground,
  rim: orb?.rim ?? mono ?? undefined,
})

// An orb's number is in its own ink until the target is lost, which turns it as it does any disc.
const orbInk = (orb: { ink: string } | undefined, failed: boolean) =>
  orb !== undefined && !failed ? { color: orb.ink } : undefined

export const fontSizeForDigits = (value: number, scale: number): number => {
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
  drawn = false,
  bare,
  orb,
  settles = false,
  glimpse = null,
  revealed = false,
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
  // Whether the disc is **drawn**: a circle ruled in pencil, filled with `backgroundColor`, its
  // clock a heavier pencil line laid over the circle and running down round it. The `drafted`
  // target form's. Without it the disc is the ring-and-pie every other form is.
  drawn?: boolean
  // A number with nothing round it: no disc, no ring, no arcs, only the numeral in `ink`. The clock
  // still runs under it — it is what expires the target — but is not drawn, so whoever asks for this
  // shows the time left some other way. The `blobs` form's: the number sits on wax that shrinks as
  // the clock does.
  bare?: { ink: string }
  // A disc dressed as an **orb**: a dark `ground`, a thin `rim`, the clock as an arc of `charge` running
  // round it and the number in `ink` — the way a monochrome scheme draws a disc, in colours of its own
  // rather than the scheme's. The `struck` form's.
  orb?: { ground: string; rim: string; charge: string; ink: string }
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
}) {
  const scale = size / PIE_SIZE
  // Under a **monochrome** scheme the disc is drawn the way a DOS screen would draw it: its
  // ground, a thin outline, and the clock as a thin arc round the edge rather than a
  // wedge, so the number sits on the ground and reads in the scheme's one ink. A filled
  // wedge in that ink would swallow the number drawn in it.
  // `hit` is the ink a taken number turns to as it leaves the ring: on a screen whose ground is
  // dark, the disc's own dark ink would leave it standing unseen on the ground it flies out onto.
  const { mono, ground, hit: hitInk } = useScheme().inks
  const { thin, discInk, discGround, rim } = discInks(orb, mono, ground)
  const stroke = drawn ? DRAWN_STROKE : thin ? THIN_STROKE : size / 2
  const radius = drawn
    ? size / 2 - DRAWN_INSET
    : thin
      ? size / 2 - THIN_STROKE / 2
      : size / 4
  const circumference = 2 * Math.PI * radius

  const progress = useSharedValue(startProgress) // 1 = full, 0 = empty
  const failed = exit === 'failed'
  // A clock has to be both running and there in the first place.
  const running = active && clocked
  // The multiplayer hit-flash owns the track while it lasts, so the band yields to it.
  const trackColor =
    discInk === null
      ? (backgroundColor ?? TARGET_BAND_TRACK[targetBand(value, maxValue)])
      : discGround
  // What is left of the clock, what has gone, and a lost target's disc and numeral. Under
  // a monochrome scheme the time gone is simply the ground showing through, and a lost
  // target inverts: the disc in the ink, the numeral in the ground.
  const leftInk = drawn ? PIE_INK : (discInk ?? APP_BLUE)
  const goneInk = discInk === null ? APP_RED : discGround
  const lostDisc = discInk ?? APP_RED
  const lostNumeral = discInk === null ? '#FFFFFF' : discGround

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

  const numberOpacity = usePieGlimpse({ glimpse, active, revealed })
  const {
    numberScale,
    numberSquash,
    failDiscStyle,
    numberColorStyle,
    numberHitStyle,
    ringStyle,
  } = usePieExit({ exit, settles, hitInk, lostNumeral, orbInk: orb?.ink })

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
  }))

  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
    opacity: 1 - progress.value,
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
      {bare === undefined && (
        <Animated.View style={ringStyle}>
          <Svg width={size} height={size}>
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={drawn ? 'none' : trackColor}
              strokeWidth={stroke}
              fill={drawn ? trackColor : thin ? discGround : 'none'}
            />
            {drawn && (
              <Circle
                cx={cx + DRAWN_GHOST.offset}
                cy={cy + DRAWN_GHOST.offset}
                r={radius}
                stroke={PIE_INK}
                strokeOpacity={DRAWN_GHOST.opacity}
                strokeWidth={1}
                fill="none"
              />
            )}
            {drawn && (
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={PIE_INK}
                strokeOpacity={0.85}
                strokeWidth={1.4}
                fill="none"
              />
            )}
            {/* The clock itself, over the band-tinted track: what is left of it in blue,
              what has gone in red. Both are the countdown, so a target with no clock
              draws neither and the track is the whole disc. */}
            {clocked && (
              <>
                <AnimatedCircle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  stroke={leftInk}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={circumference}
                  animatedProps={animatedProps}
                  transform={`rotate(-90, ${cx}, ${cy})`}
                />
                {/* A drawing has no red for the time gone: the circle under the line is it. */}
                {!drawn && (
                  <AnimatedCircle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    stroke={goneInk}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={circumference}
                    animatedProps={redProps}
                    transform={`rotate(-90, ${cx}, ${cy})`}
                  />
                )}
              </>
            )}
            {/* The disc's edge under a monochrome scheme, which the thin arc runs round.
              Last, so the time gone never rubs it out. */}
            {thin && (
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={rim}
                strokeWidth={1}
                fill="none"
              />
            )}
          </Svg>
          <Animated.View
            className="absolute inset-0 rounded-full"
            style={[{ backgroundColor: lostDisc }, failDiscStyle]}
          />
        </Animated.View>
      )}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={numberStyle}
      >
        <Animated.Text
          selectable={false}
          numberOfLines={1}
          className={cn(
            'font-mono font-extrabold',
            !failed && hitInk === null && bare === undefined && 'text-pie',
          )}
          style={[
            { fontSize: fontSizeForDigits(value, scale), includeFontPadding: false },
            bare !== undefined && { color: bare.ink },
            orbInk(orb, failed),
            failed && bare === undefined && numberColorStyle,
            !failed && hitInk !== null && numberHitStyle,
          ]}
        >
          {value}
        </Animated.Text>
      </Animated.View>
    </View>
  )
}

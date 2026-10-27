import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { DialBadge } from '@/components/game/dial-badge'
import { DialPulse } from '@/components/game/dial-pulse'
import { DIAL_COLORS, GRAYSCALE, STRIKE_COLORS } from '@/constants/colors'
import {
  DEFAULT_DIAL_CORNERS,
  DIAL_CORNERS,
  type DialCorners,
  type DialHint,
} from '@/constants/dial-hints'
import { mono } from '@/constants/theme'
import { LESSON_DIM, LESSON_DIM_MS } from '@/constants/tutorial'
import {
  MOVE_EFFECT,
  NO_COMMAND,
  type DialCommand,
  type DialMove,
} from '@/lib/dial-gesture'
import type { DialControl } from '@/machines/tutorial-lesson'
import type { DialOrientation } from '@/modes'

// The badges' ring, constant regardless of mode or theme — a mode-coloured border
// tied it to whichever pair a button happened to be animating through, which read
// as noise next to the badge's own fill. Lightest of the greyscale: legible on both
// surfaces without competing with the digit it is labelling.
const BADGE_BORDER_COLOR = GRAYSCALE[3]

// Values 0..8 ride the low → high tint ramp; 9 is the mode's CTA gradient.
const RAMP_MAX = 8
const TINT_TIMING = { duration: 260, easing: Easing.out(Easing.quad) }

// How far a key dims while the tutorial has it shut, and how long it takes either way.
//
// The depth is LESSON_DIM, shared with the sum — everything the lesson takes out of the
// player's hands steps back by the same amount. The clock is the tint's above, because the
// two land together: the moment the lesson hands the dial back, eight keys brighten and the
// ninth loses its halo, and two speeds there would read as two separate events. Eased out
// on the way up and in on the way down, the app's rule for anything arriving and leaving.
const DIM = LESSON_DIM
const DIM_UP = { duration: LESSON_DIM_MS, easing: Easing.out(Easing.quad) }
const DIM_DOWN = { duration: LESSON_DIM_MS, easing: Easing.in(Easing.quad) }

// How far a key warms under a strike's flame — see `heat`. Short of the full colour, so the
// key still reads as itself turning hot rather than as a different key.
const FIRE_WASH = 0.75

// Trainee's weight and max badges — small discs riding the pill's own rim rather
// than text stacked inside it, so they read off a chip built for contrast instead
// of fighting the pill's own animated fill colour.
//
// MIN still has to hold up on the smallest phones the dial ships on — an 81pt cell
// there, going by useDialMetrics, and the pill now fills all of it rather than 61pt of
// it — so a MIN-sized badge keeps well clear of the digit, and raising the floor along
// with the ratio makes every device's badge bigger rather than only the roomy ones.
const BADGE_MIN = 22
const BADGE_MAX = 34
const BADGE_RATIO = 0.28
const BADGE_FONT_SIZE = 12
const BADGE_BORDER = 1

// The same discs on the dial a lesson is given on, drawn larger.
//
// Not a second opinion about the badge: it is the same chip, and the lesson is asking a
// different thing of it. In a practice run the corner numbers are a reference beside a
// game the player is already playing, and small is right — in the tutorial they *are* the
// lesson, and the player is being asked to read them before they know what they mean.
// A notch under half the key, which is as far as a disc can grow before it starts
// crowding the digit it is labelling.
const TAUGHT_BADGE_MIN = 28
const TAUGHT_BADGE_MAX = 44
const TAUGHT_BADGE_RATIO = 0.36
const TAUGHT_BADGE_FONT_SIZE = 16

// Which way the digit leaves for each move. Up and right raise the key, so the old
// digit is pushed off the top; down and left lower it, so it drops off the bottom.
// A tap has no flip at all — it pops the digit in place — so it is not in here.
const FLIP_DIR = {
  up: -1,
  right: -1,
  down: 1,
  left: 1,
} as const satisfies Record<Exclude<DialMove, 'tap'>, 1 | -1>

// The squash under a thumb and its release. Stiffer going in than coming out: arriving
// under the finger should read as instant, leaving as settling.
const PRESS_SCALE = 0.94
const PRESS_IN = { damping: 20, stiffness: 260 }
const PRESS_OUT = { damping: 16, stiffness: 140 }

// What each hint prints. The weight wears its × so it cannot be mistaken for one of the
// three sums around it — those are all in the same units as the target, and this one is
// not. `room` and `giving` always add up to `ceiling`, which is the whole lesson.
const HINT_LABEL = {
  weight: (_value, weight) => `${weight}×`,
  ceiling: (_value, weight, top) => `${top * weight}`,
  giving: (value, weight) => `${value * weight}`,
  room: (value, weight, top) => `${(top - value) * weight}`,
} as const satisfies Record<
  DialHint,
  // `top` is the highest digit the key takes, which is the board's to say — a dial whose
  // keys only count to five has a different ceiling and a different room left.
  (value: number, weight: number, top: number) => string
>

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
  onDelta: (delta: 1 | -1, sweep: boolean) => void
  onSet: (value: number, sweep: boolean) => void
}) {
  const scale = useSharedValue(1)
  // The pill's bounce on a flip, along whichever screen axis the dial's vertical lies on.
  const bounce = useSharedValue(0)
  const frame = FLIP_FRAME[orientation]
  const numTranslateY = useSharedValue(0)
  const numOpacity = useSharedValue(1)
  const numScale = useSharedValue(1)
  const rampProgress = useSharedValue(Math.min(value, RAMP_MAX) / RAMP_MAX)
  const peakProgress = useSharedValue(value === 9 ? 1 : 0)
  // Starts where the key already stands rather than at full: a key that is dead on its
  // first render — every key but one, the moment a tutorial's guided route begins — should
  // be dim from the first frame, not fade down into it.
  const live = useSharedValue(control === 'off' ? DIM : 1)

  useEffect(() => {
    const waking = control !== 'off'
    live.value = withTiming(waking ? 1 : DIM, waking ? DIM_UP : DIM_DOWN)
  }, [control])

  // Animate the button tint whenever its value changes.
  useEffect(() => {
    // At 9 the gradient covers the pill, so the ramp underneath holds its
    // previous color: animating it up to `high` would flash a lighter blue
    // through the fading-in gradient — visible when swiping right from a low
    // value straight to 9.
    if (value !== 9) rampProgress.value = withTiming(value / RAMP_MAX, TINT_TIMING)
    peakProgress.value = withTiming(value === 9 ? 1 : 0, TINT_TIMING)
  }, [value])

  // What this key owes the machine: a change whose digit has flown out but not yet flown
  // back in. The event is sent on the way back, so the digit and the sum above the dial
  // turn over together — but a finger crossing this key again before then cancels that
  // animation, and the event would go with it. So a new move pays off the old one first,
  // and a scrub the animation cannot keep up with loses frames rather than presses.
  const owed = useSharedValue<DialCommand | null>(null)

  const fire = ({ move, sweep }: DialCommand) => {
    'worklet'
    inFlight.value -= 1
    const { step, set } = MOVE_EFFECT[move]
    // `set` names an end of the key's range rather than a digit — how high a key goes is
    // the board's business — so the end is turned into a value here.
    if (step === null) scheduleOnRN(onSet, set === 'floor' ? 0 : digits - 1, sweep)
    else scheduleOnRN(onDelta, step, sweep)
  }

  const settle = () => {
    'worklet'
    const command = owed.value
    if (command === null) return
    owed.value = null
    fire(command)
  }

  // The digit leaves the way the finger sent it and comes back from the other side.
  const animateFlip = (dir: 1 | -1) => {
    'worklet'
    bounce.value = withSequence(
      withTiming(dir * 7, { duration: 100 }),
      withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 }),
    )

    numOpacity.value = withTiming(0, { duration: 110 })
    numTranslateY.value = withTiming(dir * 18, { duration: 110 }, (finished) => {
      if (!finished) return
      settle()
      numTranslateY.value = dir * -18
      numTranslateY.value = withSpring(0, { damping: 22, stiffness: 160 })
      numOpacity.value = withTiming(1, { duration: 130 })
    })
  }

  const animateTap = () => {
    'worklet'
    numScale.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withSpring(1, { damping: 18, stiffness: 160 }),
    )
  }

  const run = (command: DialCommand) => {
    'worklet'
    settle()
    // A tap has nothing to wait for: the digit pops where it stands rather than leaving,
    // so there is no flight for the press to be owed across.
    if (command.move === 'tap') {
      animateTap()
      fire(command)
      return
    }
    owed.value = command
    animateFlip(FLIP_DIR[command.move])
  }

  // The squash follows the thumb rather than belonging to a press. One gesture crosses
  // several keys now, and each takes the squash as the finger arrives and gives it up as
  // it leaves — so what is under the finger is always the key that is about to change.
  useAnimatedReaction(
    () => pressed.value === index,
    (down, was) => {
      if (down === was) return
      scale.value = withSpring(down ? PRESS_SCALE : 1, down ? PRESS_IN : PRESS_OUT)
    },
  )

  // How a key hears that the pan just left it. Keyed on the counter rather than the move:
  // leaving the same key the same way twice running is two changes, and comparing the
  // moves would see one.
  useAnimatedReaction(
    () => commands.value[index] ?? NO_COMMAND,
    (command, previous) => {
      if (previous === null || command.seq === previous.seq) return
      run(command)
    },
  )

  const btnStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      frame.bounce === 'x' ? { translateX: bounce.value } : { translateY: bounce.value },
    ],
    backgroundColor: interpolateColor(
      rampProgress.value,
      [0, 1],
      [DIAL_COLORS.low, DIAL_COLORS.high],
    ),
  }))

  // The CTA gradient crossfades in over the ramp — every tint change, including
  // the jump to and from 9, is a timed transition.
  const peakStyle = useAnimatedStyle(() => ({ opacity: peakProgress.value }))

  const liveStyle = useAnimatedStyle(() => ({ opacity: live.value }))

  const fireStyle = useAnimatedStyle(() => ({ opacity: FIRE_WASH * (heat?.value ?? 0) }))

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
      [DIAL_COLORS.text, DIAL_COLORS.peakText],
    ),
  }))

  // The pill fills its box, so its radius is simply half of it. There used to be 10pt
  // of padding here, reserving room for the shadow and for the badges to straddle. It
  // also sat inside every button, which put 20pt on top of the 12pt gap the dial lays
  // out — the space between two pills read as 32, and the gap in the layout was not
  // the gap on the screen.
  const radius = size / 2
  const badgeSize = bigHints
    ? Math.min(
        TAUGHT_BADGE_MAX,
        Math.max(TAUGHT_BADGE_MIN, Math.round(size * TAUGHT_BADGE_RATIO)),
      )
    : Math.min(BADGE_MAX, Math.max(BADGE_MIN, Math.round(size * BADGE_RATIO)))
  // Where a badge centred on the pill's rim, on the diagonal toward a corner, lands:
  // the distance from that corner in to the circle — a circle's closest approach to its
  // bounding square's corner is radius short of it on both axes, by Math.SQRT1_2
  // (cos/sin 45°). Expressed as a top/left (or, mirrored, bottom/right) offset from the
  // box so the badge's own centre, not its corner, sits exactly on the rim. It stays
  // positive at every size the dial produces for the small badge — and can go a little
  // negative for the lesson's larger one, where the disc is wide enough that its centre on
  // the rim would put its edge outside the box. Held at the corner there instead, which
  // rests the badge a hair outside the rim rather than hanging it off the key.
  const badgeOffset = Math.max(0, radius * (1 - Math.SQRT1_2) - badgeSize / 2)

  return (
    // Explicit pixel size (not w-1/3 + aspect-square): iOS WebKit fails to derive height
    // from aspect-ratio on wrapping flex children. The two badges below are positioned
    // against this box, not the pill inside it, so they can straddle the pill's rim
    // rather than being clipped by it.
    //
    // No gesture of its own: nine separate pans could each only ever hear the key the
    // finger landed on, and a drag across the dial has to be heard by all of them. The
    // one pan that is lives on the square above — components/game/dial.tsx.
    <Animated.View style={[{ width: size, height: size }, liveStyle]}>
      {/* Outside the pill, so it is drawn over the surface between keys rather than
            over a fill this blue would disappear into. */}
      {hinted && <DialPulse />}
      <Animated.View
        style={[
          {
            flex: 1,
            borderRadius: 999,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            shadowColor: '#1C1928',
            shadowOpacity: 0.13,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 10,
          },
          btnStyle,
        ]}
      >
        {/* Rounded on its own rather than clipped by the pill — `overflow:
              hidden` on the parent would clip away the button's shadow too. */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
            peakStyle,
          ]}
        >
          <LinearGradient
            colors={[peakFrom, peakTo]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, borderRadius: 999 }}
          />
        </Animated.View>
        {/* The key turning hot under a strike: red at the crown, gold at the base where a
              fire burns hottest. Over the fill and under the digit, like the peak above. */}
        {heat !== null && (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
              fireStyle,
            ]}
          >
            <LinearGradient
              colors={[STRIKE_COLORS.cool, STRIKE_COLORS.hot]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ flex: 1, borderRadius: 999 }}
            />
          </Animated.View>
        )}
        <Animated.Text
          selectable={false}
          style={[
            {
              fontSize: 30,
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
      </Animated.View>

      {/* The corner numbers, as facts pinned to the pill's rim rather than stacked
            with the digit. Each rides the corner it is about: what the key is worth
            top-left, what it could still add top-right, what it gives now bottom-left,
            and its ceiling bottom-right, on the corner the value climbs toward. */}
      {trainee &&
        DIAL_CORNERS.flatMap((corner) => {
          const hint = corners[corner]
          return hint === null ? [] : [{ corner, hint }]
        }).map(({ corner, hint }) => (
          <DialBadge
            key={corner}
            label={HINT_LABEL[hint](value, weight, digits - 1)}
            size={badgeSize}
            fontSize={bigHints ? TAUGHT_BADGE_FONT_SIZE : BADGE_FONT_SIZE}
            offset={badgeOffset}
            corner={corner}
            low={DIAL_COLORS.low}
            high={DIAL_COLORS.high}
            text={DIAL_COLORS.text}
            peakText={DIAL_COLORS.peakText}
            peakFrom={peakFrom}
            peakTo={peakTo}
            borderColor={BADGE_BORDER_COLOR}
            borderWidth={BADGE_BORDER}
            rampProgress={rampProgress}
            peakProgress={peakProgress}
            scale={scale}
          />
        ))}
    </Animated.View>
  )
}

import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { SiegeSoldier } from '@/components/game/siege-soldier'
import {
  ARROW_MS,
  BLOOD_MS,
  BLOW_MS,
  DUST_MS,
  STONE_MS,
  WARRIOR_SIZE,
} from '@/constants/siege'
import { mapLabel } from '@/constants/theme'
import { wobble } from '@/lib/map-marks'
import type { Blow } from '@/machines/siege'

// What a press did, drawn: a stone thrown at a tower and the dust it brings off, or an
// arrow put through a man and the blood that follows it.
//
// A blow is a *moment*, and the state it came out of has already moved on — the man is cut
// from the list the instant the key lands, and the tower is simply shorter. So nothing here
// reads the fight. It is handed one `Blow`, mounted on it, and plays once: one clock from
// nought to one over the whole of `BLOW_MS`, with every part of the effect taking its own
// stretch of that clock. Unmounted when it is done, by whoever mounted it.
//
// Everything is drawn in the map's own hand and the map's own inks — dust is the wall's own
// stone in the air, so it is the sheet's grey rather than a colour of its own. Blood is the
// one exception and is arcade's own red, the mode's first gradient stop: the screen has one
// red already and a siege does not get a second.

// Where the shot comes from, and how high the stone is thrown. A catapult lobs, so the
// stone leaves the hero on a curve well over the ground it crosses; an arrow is flat.
const ARC = 46

// The stone, and the arrow's head and shaft. In map points, which the siege camera doubles.
// Both are drawn a good deal larger than the thing they would really be: at the scale this
// map is kept, a stone the size of a stone is a speck, and a speck crossing the ground is a
// dust mote rather than a shot.
const STONE = 4.2
const SHAFT = 13
const HEAD = 3.2

// The tail of the arrow: the feathers and the notch the string sits in.
//
// `NOCK` is the length of shaft left bare behind the fletching for the notch to be cut
// into, and `FLETCH` is how far forward of it the feathers are rooted. An arrow drawn as a
// line with a chevron on the end is a pointer; what makes it an arrow is that the two ends
// are different, and the nock is the end that says which way it was loosed from.
const NOCK = 1.6
const FLETCH = 3.4

// How many puffs of dust a hit brings down, and how many more the tower's own fall does.
const PUFFS = 6
const FELLED_PUFFS = 11
const DUST_NEAR = 5
const DUST_FAR = 18

// And how many drops of blood, and how far they are thrown.
const DROPS = 7
const BLOOD_FAR = 13

// How long the man stands after the arrow reaches him before he goes. Short — he is dead
// when it lands, and this is the beat it takes to fall rather than a stagger.
const FALL_MS = 180

// ── the parts ───────────────────────────────────────────────────────────────

// One puff of dust, or one drop of blood: a disc thrown out of the point of impact, growing
// as it goes and gone by the time it stops.
//
// Module level, like every animated sub-component in this app — one defined inside a render
// is remounted on every frame its parent draws.
function Mote({
  clock,
  from,
  to,
  angle,
  reach,
  rise,
  size,
  grow,
  color,
  opacity,
}: {
  // The blow's own clock, nought to one over `BLOW_MS`.
  clock: SharedValue<number>
  // The stretch of that clock this mote lives over.
  from: number
  to: number
  angle: number
  reach: number
  // How far the mote drifts up the sheet as it goes, over and above its own direction. Dust
  // rises; blood does not.
  rise: number
  size: number
  grow: number
  color: string
  opacity: number
}) {
  const drifting = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (clock.value - from) / (to - from)))
    // Out fast and then slowing, which is what a thrown thing does.
    const out = 1 - (1 - k) * (1 - k)
    return {
      opacity: k <= 0 || k >= 1 ? 0 : opacity * (1 - k * k),
      transform: [
        { translateX: Math.cos(angle) * reach * out },
        { translateY: Math.sin(angle) * reach * out - rise * out },
        { scale: 0.35 + grow * out },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        drifting,
      ]}
    />
  )
}

// The shot crossing the ground: a stone lobbed in an arc, or an arrow sent flat and fast.
//
// Both travel from the hero to wherever the blow landed, and both are gone the moment they
// arrive — what is left behind is the dust or the blood, which is a part of its own.
function Shot({
  clock,
  span,
  toX,
  toY,
  fromY,
  arc,
  turn,
  children,
}: {
  clock: SharedValue<number>
  // The stretch of the blow's clock the flight takes.
  span: number
  toX: number
  toY: number
  fromY: number
  arc: number
  // Whether the shot turns to point the way it is going. A stone tumbles; an arrow does not.
  turn: boolean
  children: React.ReactNode
}) {
  const flying = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, clock.value / span))
    const x = toX * k
    const y = fromY + (toY - fromY) * k - Math.sin(k * Math.PI) * arc
    // The angle of the line the shot is actually on right now, which for an arrow is the
    // way it points and for a stone is the way it spins.
    const lean = turn
      ? Math.atan2(toY - fromY - Math.cos(k * Math.PI) * Math.PI * arc, toX)
      : k * 7
    return {
      // Gone as it arrives rather than at the moment it does: what takes over is the dust
      // or the blood, and a shot that blinked out would read as a frame dropped.
      opacity: Math.min(1, (1 - k) * 8),
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${lean}rad` }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, flying]}
    >
      {children}
    </Animated.View>
  )
}

// The man, for as long as it takes him to fall.
//
// He is already out of the fight — his number stopped answering the instant the press
// landed — so this is a drawing of someone who is no longer there. It has to be: without it
// he would vanish on the key and the arrow would arrive at open ground.
function Falling({
  clock,
  value,
  ink,
  line,
  face,
}: {
  clock: SharedValue<number>
  value: number
  ink: string
  line: string
  face: string
}) {
  const hold = ARROW_MS / BLOW_MS
  const gone = (ARROW_MS + FALL_MS) / BLOW_MS

  const falling = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (clock.value - hold) / (gone - hold)))
    return {
      opacity: 1 - k,
      transform: [{ scale: 1 + k * 0.4 }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[
        {
          left: -WARRIOR_SIZE / 2,
          top: -WARRIOR_SIZE / 2,
          width: WARRIOR_SIZE,
          height: WARRIOR_SIZE,
        },
        falling,
      ]}
    >
      <SiegeSoldier line={line} face={face} />
      <Text
        selectable={false}
        className="font-semibold"
        style={{ fontFamily: mapLabel, color: ink, fontSize: 6.5 }}
      >
        {value}
      </Text>
    </Animated.View>
  )
}

// ── the blow ────────────────────────────────────────────────────────────────

export function SiegeBlow({
  blow,
  x,
  y,
  fromY,
  ink,
  line,
  dust,
  blood,
  face,
}: {
  blow: Blow
  // Where it landed, in the field's own frame: across the wall and down the ground.
  x: number
  y: number
  // How far down the ground the hero is standing, which is where both shots come from. The
  // hero is always straight below the gate, so the shot needs no x of its own.
  fromY: number
  ink: string
  line: string
  dust: string
  blood: string
  face: string
}) {
  const clock = useSharedValue(0)
  useEffect(() => {
    clock.value = withTiming(1, { duration: BLOW_MS, easing: Easing.linear })
  }, [])

  // The scatter of this one blow. Seeded on its own number, so two hits on the same tower
  // throw their dust differently and neither re-rolls on a re-render.
  const rnd = wobble(blow.id * 2654435761)
  const felled = blow.tower?.felled === true

  const parts =
    blow.tower !== null
      ? {
          land: STONE_MS / BLOW_MS,
          over: (STONE_MS + DUST_MS) / BLOW_MS,
          motes: felled ? FELLED_PUFFS : PUFFS,
          color: dust,
          // Dust goes up and out; a flattened tower throws it further and holds it longer.
          far: felled ? DUST_FAR * 1.5 : DUST_FAR,
          near: DUST_NEAR,
          rise: felled ? 10 : 6,
          size: felled ? 8 : 6,
          fade: 0.5,
        }
      : {
          land: ARROW_MS / BLOW_MS,
          over: (ARROW_MS + BLOOD_MS) / BLOW_MS,
          motes: DROPS,
          color: blood,
          far: BLOOD_FAR,
          near: 2,
          // Blood is thrown and then falls. Nothing about it rises.
          rise: -3,
          size: 4.6,
          fade: 0.9,
        }

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}
    >
      {/* The shot, from the hero to the point of impact. */}
      <Shot
        clock={clock}
        span={parts.land}
        toX={x}
        toY={y}
        fromY={fromY}
        arc={blow.tower !== null ? ARC : 0}
        turn={blow.tower === null}
      >
        {blow.tower !== null ? (
          <Svg
            width={STONE * 2}
            height={STONE * 2}
            style={{ position: 'absolute', left: -STONE, top: -STONE }}
          >
            {/* A stone rather than a ball: five flat faces, which is what the same hand
                draws a boulder on this map with. */}
            <Path
              d={`M${-STONE} ${-STONE * 0.3} L${-STONE * 0.4} ${-STONE} L${STONE * 0.7} ${-STONE * 0.6} L${STONE} ${STONE * 0.5} L0 ${STONE} Z`}
              transform={`translate(${STONE} ${STONE})`}
              fill={face}
              stroke={line}
              strokeWidth={1}
              strokeLinejoin="miter"
            />
          </Svg>
        ) : (
          <Svg
            width={SHAFT + HEAD}
            height={HEAD * 2}
            style={{ position: 'absolute', left: -SHAFT, top: -HEAD }}
            viewBox={`${-SHAFT} ${-HEAD} ${SHAFT + HEAD} ${HEAD * 2}`}
          >
            {/* The shaft, the feathers swept back off it, and the notch at the very end.
                All one stroke in the map's own line weight. */}
            <Path
              d={[
                `M${-SHAFT} 0 L0 0`,
                `M${-SHAFT + NOCK + FLETCH} 0 L${-SHAFT + NOCK} ${-HEAD * 0.85}`,
                `M${-SHAFT + NOCK + FLETCH} 0 L${-SHAFT + NOCK} ${HEAD * 0.85}`,
                `M${-SHAFT} ${-NOCK * 0.85} L${-SHAFT + NOCK} 0 L${-SHAFT} ${NOCK * 0.85}`,
              ].join(' ')}
              fill="none"
              stroke={line}
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* And the head, filled and barbed rather than drawn as two more lines: a
                solid point is what reads at this size, and the barbs are what keep it from
                reading as a paper dart. */}
            <Path
              d={`M0 0 L${-HEAD * 1.25} ${-HEAD * 0.82} L${-HEAD * 0.86} 0 L${-HEAD * 1.25} ${HEAD * 0.82} Z`}
              fill={line}
              stroke={line}
              strokeWidth={0.5}
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </Shot>

      {/* And what it left where it landed. */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}
      >
        {blow.warrior !== null && (
          <Falling
            clock={clock}
            value={blow.warrior.value}
            ink={ink}
            line={line}
            face={face}
          />
        )}
        {Array.from({ length: parts.motes }, (_, i) => (
          <Mote
            key={i}
            clock={clock}
            // Spread across the settling rather than loosed as one batch, so the dust
            // builds and rolls off instead of arriving whole.
            from={parts.land + (parts.over - parts.land) * (rnd() + 0.5) * 0.22}
            to={parts.over}
            angle={(i / parts.motes) * Math.PI * 2 + rnd()}
            reach={parts.near + (rnd() + 0.5) * (parts.far - parts.near)}
            // Some of it up and some of it down: what a stone brings off a tower is dust,
            // which rises, and rubble, which does not.
            rise={parts.rise * (rnd() * 2 + 0.6)}
            size={parts.size * (0.6 + (rnd() + 0.5) * 0.9)}
            grow={blow.tower !== null ? 1.1 : 0.3}
            color={parts.color}
            opacity={parts.fade}
          />
        ))}
      </Animated.View>
    </Animated.View>
  )
}

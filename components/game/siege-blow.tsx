import { useEffect } from 'react'
import Animated, { Easing, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { SiegeFalling } from '@/components/game/siege-falling'
import { SiegeMote } from '@/components/game/siege-mote'
import { SiegeShot } from '@/components/game/siege-shot'
import { ARROW_MS, BLOOD_MS, BLOW_MS, DUST_MS, STONE_MS } from '@/constants/siege'
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

// The parts — the shot, its dust or blood, the man going down — are each a file of their
// own beside this one: `SiegeShot`, `SiegeMote`, `SiegeFalling`.

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
      <SiegeShot
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
      </SiegeShot>

      {/* And what it left where it landed. */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}
      >
        {blow.warrior !== null && (
          <SiegeFalling
            clock={clock}
            value={blow.warrior.value}
            ink={ink}
            line={line}
            face={face}
          />
        )}
        {Array.from({ length: parts.motes }, (_, i) => (
          <SiegeMote
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

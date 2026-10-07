import Svg, { Path } from 'react-native-svg'

import { rampartHeight, rampartMarks } from '@/lib/siege-marks'

// The wall between the towers: one stretch of a besieged village's near side, with the gate
// in the middle of it.
//
// What makes the fight a place rather than a row of towers on nothing. It runs off both
// edges of the canvas, because a village that can hold out against a hero is wider than the
// screen — what is drawn is the part of it the hero is standing in front of, and the rest is
// understood.
//
// The shape of it is in lib/siege-marks.ts, with the towers': a wall is a drawing, and a
// drawing is a pure function of what it is of. All this does is give it a box and ink it,
// body first and then its courses — which is the order every mark on this map is laid down
// in, the filled body knocking out the country behind the wall and the detail going on over
// it.

// Town-mark's plain line weight, which is what every mark in a siege is built in. The camera
// supplies the heavier build a fortified town is drawn in for free.
const STROKE = 1.2
const COURSE = 0.7

// Room for the stroke, which SVG centres on the path and would otherwise clip.
const PAD = 1

export function SiegeRampart({
  half,
  bow,
  gate,
  seed,
  line,
  hatch,
  face,
}: {
  // Half the wall's span, in map points: it runs from `-half` to `+half` either side of the
  // gate, which stands on the village itself.
  half: number
  // How far the two ends stand back from the middle.
  bow: number
  // How wide the opening in the middle is.
  gate: number
  // The village's own seed, so one wall's waver is its own and the same one every frame.
  seed: number
  line: string
  hatch: string
  // The ground's own colour, which every mark on this map knocks out with — and which is
  // what makes the wall stand in front of the country behind it.
  face: string
}) {
  const wall = rampartMarks(half, bow, gate, seed)
  const over = rampartHeight(bow)
  const boxW = (half + PAD) * 2
  const boxH = over + PAD * 2
  const ox = half + PAD
  const oy = over + PAD

  return (
    <Svg
      width={boxW}
      height={boxH}
      pointerEvents="none"
      style={{ position: 'absolute', left: -ox, top: -oy }}
      viewBox={`${-ox} ${-oy} ${boxW} ${boxH}`}
    >
      <Path
        d={wall.body}
        fill={face}
        fillRule="evenodd"
        stroke={line}
        strokeWidth={STROKE}
        strokeLinejoin="miter"
      />
      <Path
        d={wall.detail}
        fill="none"
        stroke={hatch}
        strokeWidth={COURSE}
        strokeLinecap="round"
      />
    </Svg>
  )
}

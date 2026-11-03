import type { ReactNode } from 'react'
import Svg, { Circle, G, Path } from 'react-native-svg'

import { DialMark } from '@/components/overlays/dial-mark'
import { SURFACE } from '@/constants/colors'
import { dialOf, markOf, type MarkKind, type ModeId } from '@/modes'

// A challenge's mark: a small drawing of the one thing it is about, beside its name.
//
// It was the dial drawn as dots, which was free and true — and then nine of the ten
// challenges turned out to be played on the same nine keys, so nine of them wore the same
// three rows of three. A mark has to tell one challenge from the next before it says
// anything else, so each one now names a drawing (`mark` on the spec) and the dots are
// only what a challenge that names none falls back to.
//
// One ink, in layers: a pale wash of it under the shapes and the full colour on the
// lines, so a 20pt drawing reads with some depth without needing a second colour that
// would have to be cleared against every hue in the palette.
//
// Drawn on a 24-unit square and scaled to whatever the caller hands over — the card
// measures its own text block, the lab uses a constant. `aria-hidden` for the reason
// `DialMark` gives: the name beside it says everything a screen reader needs.

const STROKE = 1.6
// How strong the wash under a shape is. Enough to read as a filled key at 20pt, little
// enough that the line on top is still what the eye follows.
const WASH = 0.2

const line = (color: string) =>
  ({
    stroke: color,
    strokeWidth: STROKE,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  }) as const

// A rounded rectangle as a path. `Rect`'s own `x` and `y` are deprecated in this
// version of react-native-svg in favour of a transform, which would make every key a
// translate wrapped round a shape at the origin.
const box = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} ` +
  `A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
  `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`

// Twelve angles round a clock face, for the two drawings that are built by turning one
// stroke about the centre.
const TWELVE = Array.from({ length: 12 }, (_, i) => i * 30)
const SIX = Array.from({ length: 6 }, (_, i) => i * 60)

// FOUR BY FOUR's sixteen keys, row by row: four shades scattered by hand so no row,
// column or diagonal repeats a pattern, which is what reads as random at 20pt.
const GRID_SHADES = [
  1, 0.25, 0.6, 0.4, 0.4, 0.8, 0.25, 1, 0.25, 1, 0.4, 0.6, 0.6, 0.4, 1, 0.25,
] as const

// DRIFT's two tyre tracks, swinging out of a bend side by side.
const TRACKS = [
  'M1.5 16.5 C7 16.5 9.5 10.5 13.5 7.8 C16 6.1 19 5.5 22.5 5.5',
  'M5 22.5 C11 22.5 14 16.5 17.5 14 C19.3 12.7 21 12.2 23 12.2',
] as const

// BLACKOUT's bulb: the glass, narrowing to the neck the base screws into.
const BULB =
  'M12 2.2 C7.7 2.2 5 5.4 5 9.2 C5 11.8 6.3 13.4 7.7 14.8 C8.6 15.7 9 16.5 9 17.6 ' +
  'H15 C15 16.5 15.4 15.7 16.3 14.8 C17.7 13.4 19 11.8 19 9.2 C19 5.4 16.3 2.2 12 2.2 Z'

// FOUR KEYS' bolt, drawn twice: once as its own halo, once filled on top of it.
const BOLT = 'M15 1.5 L5.5 13.6 H11 L9 22.5 L18.5 10.2 H13 Z'

const GLYPHS: Record<MarkKind, (color: string) => ReactNode> = {
  // FOUR KEYS — four keys and the bolt that is their doubled speed.
  boltKeys: (color) => (
    <>
      {(
        [
          [2.5, 2.5],
          [13, 2.5],
          [2.5, 13],
          [13, 13],
        ] as const
      ).map(([x, y]) => (
        <Path
          key={`${x}-${y}`}
          d={box(x, y, 8.5, 8.5, 2)}
          {...line(color)}
          fill={color}
          fillOpacity={WASH}
        />
      ))}
      {/* Cut out of the keys by a halo in the ground colour, or the bolt is the same ink
        as the keys under it and disappears into them. */}
      <Path d={BOLT} stroke={SURFACE} strokeWidth={3} strokeLinejoin="round" />
      <Path d={BOLT} fill={color} />
    </>
  ),

  // FOUR BY FOUR — sixteen keys, lit in scattered shades.
  crossGrid: (color) => (
    <>
      {GRID_SHADES.map((shade, i) => (
        <Path
          key={i}
          d={box(1.8 + (i % 4) * 5.4, 1.8 + Math.floor(i / 4) * 5.4, 4.2, 4.2, 1)}
          fill={color}
          fillOpacity={shade}
        />
      ))}
    </>
  ),

  // HABIT — the same nine, and the one route through them a player learns by heart.
  route: (color) => (
    <>
      {[4, 12, 20].flatMap((y) =>
        [4, 12, 20].map((x) => (
          <Circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={2.2}
            fill={color}
            fillOpacity={0.3}
          />
        )),
      )}
      <Path d="M4 4 L12 12 H20 V20" {...line(color)} strokeWidth={2.4} />
      <Circle cx={4} cy={4} r={3} fill={color} />
      <Circle cx={12} cy={12} r={2.2} fill={color} />
      <Circle cx={20} cy={12} r={2.2} fill={color} />
      <Circle cx={20} cy={20} r={3} fill={color} />
    </>
  ),

  // GLIMPSE — the look is over: a closed eye, the lid down and its lashes with it, the
  // crease of the open eye still showing above.
  closedEye: (color) => (
    <>
      <Path
        d="M2.5 10 C6 4.5 18 4.5 21.5 10 C18 16 6 16 2.5 10 Z"
        fill={color}
        fillOpacity={WASH}
      />
      <Path d="M5 7 C8.5 3.8 15.5 3.8 19 7" {...line(color)} strokeOpacity={0.45} />
      <Path d="M2.5 10 C6 16 18 16 21.5 10" {...line(color)} />
      <Path
        d="M5.5 12.9 L3.8 15.4 M8.6 14.1 L7.6 17 M12 14.5 V17.6 M15.4 14.1 L16.4 17 M18.5 12.9 L20.2 15.4"
        {...line(color)}
      />
    </>
  ),

  // NO SLIP — the one life, and the crack one slip would put through it.
  crackedHeart: (color) => (
    <>
      <Path
        d="M12 20.5 C12 20.5 3 15 3 8.8 C3 6 5.1 4 7.6 4 C9.4 4 11 5 12 6.6 C13 5 14.6 4 16.4 4 C18.9 4 21 6 21 8.8 C21 15 12 20.5 12 20.5 Z"
        {...line(color)}
        fill={color}
        fillOpacity={WASH}
      />
      <Path d="M12 6.6 L10.4 10.2 L13.4 12.6 L11 15.8 L12.3 18.6" {...line(color)} />
    </>
  ),

  // SIDEWAYS — the dial on its side, and the turn that put it there.
  turnedDial: (color) => (
    <>
      <Path d={box(2, 8, 15, 11, 2.2)} {...line(color)} fill={color} fillOpacity={WASH} />
      {[10.5, 13.5, 16.5].flatMap((y) =>
        [5.8, 9.5, 13.2].map((x) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={1} fill={color} />
        )),
      )}
      <Path d="M13 2.5 A7.5 7.5 0 0 1 20.5 10" {...line(color)} />
      <Path d="M18.3 9.6 H22.7 L20.5 13 Z" fill={color} />
    </>
  ),

  // DRIFT — two tyres sliding out of a bend, their tread left on the road.
  drift: (color) => (
    <>
      {TRACKS.map((d) => (
        <G key={d}>
          <Path d={d} {...line(color)} strokeWidth={3.6} strokeOpacity={WASH} />
          <Path
            d={d}
            stroke={color}
            strokeWidth={2.8}
            strokeDasharray="1 1.2"
            fill="none"
          />
        </G>
      ))}
    </>
  ),

  // ONE KEY — one key inside the second it has, the first quarter of it gone.
  stopwatchKey: (color) => (
    <>
      {TWELVE.map((angle, i) => (
        <G key={angle} transform={`rotate(${angle} 12 12)`}>
          <Path
            d={i % 3 === 0 ? 'M12 1.2 V4' : 'M12 1.4 V3.2'}
            {...line(color)}
            strokeOpacity={i < 3 ? 1 : 0.35}
          />
        </G>
      ))}
      <Path d={box(7, 7, 10, 10, 2.4)} {...line(color)} fill={color} fillOpacity={WASH} />
      <Path d={box(9.2, 8.8, 5.6, 5, 1.2)} fill={color} fillOpacity={0.6} />
    </>
  ),

  // SCRAMBLE — two lanes crossing, and the sparks a hit throws the dial into.
  shuffle: (color) => (
    <>
      <Path d="M2.5 7 H6.5 C11 7 13 17 17.5 17 H21" {...line(color)} />
      <Path d="M2.5 17 H6.5 C11 17 13 7 17.5 7 H21" {...line(color)} />
      <Path
        d="M18.4 4.2 L21.4 7 L18.4 9.8 M18.4 14.2 L21.4 17 L18.4 19.8"
        {...line(color)}
      />
      <Path
        d="M12 1 L13 2.5 L12 4 L11 2.5 Z M12 20 L13 21.5 L12 23 L11 21.5 Z"
        fill={color}
      />
    </>
  ),

  // FREEZE — the sum held still: a six-armed flake, each arm branched twice.
  snowflake: (color) => (
    <>
      {SIX.map((angle) => (
        <G key={angle} transform={`rotate(${angle} 12 12)`}>
          <Path
            d="M12 12 V1.8 M12 5.6 L9.4 3.4 M12 5.6 L14.6 3.4 M12 9 L10.2 7.4 M12 9 L13.8 7.4"
            {...line(color)}
          />
        </G>
      ))}
      <Circle cx={12} cy={12} r={2.2} fill={color} />
    </>
  ),

  // BINARY — an old computer: a boxy monitor on a short neck, its screen lit and a
  // cursor waiting on it, and the keyboard in front.
  computer: (color) => (
    <>
      <Path
        d={box(2.5, 1.8, 19, 14.4, 2.4)}
        {...line(color)}
        fill={color}
        fillOpacity={WASH}
      />
      <Path d={box(5.2, 4.4, 13.6, 9.2, 1.4)} fill={color} />
      {/* The cursor, cut out of the screen in the ground colour. */}
      <Path d={box(7.4, 9.4, 2.6, 2.6, 0.3)} fill={SURFACE} />
      <Path d="M10 16.2 V18.6 M14 16.2 V18.6" {...line(color)} />
      <Path
        d={box(3.5, 18.6, 17, 3.6, 1.2)}
        {...line(color)}
        fill={color}
        fillOpacity={WASH}
      />
    </>
  ),

  // MIRROR — a key with a 7 on it, and its reflection across the glass: the same key
  // turned the other way, fainter, the way a reflection is.
  mirror: (color) => (
    <>
      <Path d={box(1.5, 5, 9, 14, 2)} {...line(color)} fill={color} fillOpacity={WASH} />
      <Path d="M4 8.6 H8 L5.6 15.4" {...line(color)} strokeWidth={1.8} />
      <Path d="M12 2.5 V21.5" {...line(color)} strokeWidth={1} strokeDasharray="1.4 2" />
      <G opacity={0.5}>
        <Path
          d={box(13.5, 5, 9, 14, 2)}
          {...line(color)}
          fill={color}
          fillOpacity={WASH}
        />
        <Path d="M20 8.6 H16 L18.4 15.4" {...line(color)} strokeWidth={1.8} />
      </G>
    </>
  ),

  // BLACKOUT — the light is off: a bulb with no rays round it, its filament gone cold
  // and faint inside the glass, and the screw base under it.
  bulb: (color) => (
    <>
      <Path d={BULB} {...line(color)} fill={color} fillOpacity={WASH / 2} />
      <Path
        d="M10 17.4 V13.4 L11 11.8 L12 13.4 L13 11.8 L14 13.4 V17.4"
        {...line(color)}
        strokeWidth={1.2}
        strokeOpacity={0.45}
      />
      <Path d="M9.2 19.6 H14.8 M10 21.8 H14" {...line(color)} />
    </>
  ),
}

export function ChallengeMark({
  modeId,
  color,
  size,
}: {
  modeId: ModeId
  color: string
  // The square the mark is drawn inside — see the note on `DialMark`'s own.
  size: number
}) {
  const mark = markOf(modeId)
  if (mark !== null) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        {GLYPHS[mark](color)}
      </Svg>
    )
  }
  const dial = dialOf(modeId)
  return dial === null ? null : <DialMark dial={dial} color={color} size={size} />
}

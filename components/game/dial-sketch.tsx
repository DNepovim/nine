import { Text, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { G, Path } from 'react-native-svg'

import { DIM_INK, PRIMARY_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { laneTotals } from '@/lib/dial-carve'
import type { DialMetrics } from '@/lib/dial-metrics'
import {
  arrowsD,
  DIM,
  dimensionD,
  DRAW,
  edgesOf,
  frameD,
  phaseOf,
  SKETCH_PAD,
} from '@/lib/dial-sketch'
import type { DialSpec } from '@/modes'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// A **proportional** dial drawn as the drawing it is: the square ruled in pencil, and the
// dimensions of what it has been cut into written round it, as on an engineer's sheet — the
// columns along the bottom, the rows up the left. See `DialSpec.proportional`.
//
// A dimension is what its row or column holds: the digits times their weights, added up.
// Which is also what the cut is made from, so the figure and the line are the same fact
// said twice, and a column that reads 16 beside one that reads 7 is drawn 16 to 7.
//
// Every line is one path redrawn from the cut each frame rather than a view per line, so the
// whole drawing follows the digits without a render. Drawn over the keys and never in the
// way of them.

// The room a label is placed in: a line of `TYPE.labelSm` and enough width for two figures.
// A label rests `LIFT` above its dimension line, on the side the drawing is on.
const LABEL_WIDTH = 28
const LABEL_HEIGHT = 12
const LIFT = 2

// The second stroke laid beside the first, fainter, which is what makes a ruled line read
// as pencil rather than as a vector.
const GHOST = { dx: 0.9, dy: 0.7, opacity: 0.4, width: 1 } as const

// One figure on a dimension line, at the middle of the lane it measures. `side` is the
// axis it is on: the bottom's read across, the left's up the page, as on the sheet.
function DimensionLabel({
  side,
  lane,
  xs,
  ys,
  sweep,
  children,
}: {
  side: 'bottom' | 'left'
  lane: number
  xs: SharedValue<number[]>
  ys: SharedValue<number[]>
  sweep: SharedValue<number>
  children: string
}) {
  const place = useAnimatedStyle(() => {
    // Written once the lines are drawn: see `DRAW`.
    const written = phaseOf(sweep.value, DRAW.marks)
    if (side === 'bottom') {
      const middle = ((xs.value[lane] ?? 0) + (xs.value[lane + 1] ?? 0)) / 2
      const line = (ys.value[ys.value.length - 1] ?? 0) + DIM.OFFSET
      return {
        opacity: written,
        left: middle - LABEL_WIDTH / 2,
        top: line - LIFT - LABEL_HEIGHT,
      }
    }
    const middle = ((ys.value[lane] ?? 0) + (ys.value[lane + 1] ?? 0)) / 2
    const line = (xs.value[0] ?? 0) - DIM.OFFSET
    return {
      opacity: written,
      left: line - LIFT - LABEL_HEIGHT / 2 - LABEL_WIDTH / 2,
      top: middle - LABEL_HEIGHT / 2,
      transform: [{ rotate: '-90deg' }],
    }
  })
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: LABEL_WIDTH, height: LABEL_HEIGHT }, place]}
    >
      <Text selectable={false} className={cn(TYPE.labelSm, 'text-center text-dim')}>
        {children}
      </Text>
    </Animated.View>
  )
}

export function DialSketch({
  dial,
  metrics,
  carve,
  values,
  sweep,
}: {
  dial: DialSpec
  metrics: DialMetrics
  carve: SharedValue<number[]>
  values: readonly number[]
  // How far the drawing has been made, nought to one — an opening's `sweep`, one for a dial
  // that is simply there. See `DRAW` for what is drawn when.
  sweep: SharedValue<number>
}) {
  const xs = useDerivedValue(() =>
    edgesOf(carve.value, dial.rows, dial.cols, metrics.width),
  )
  const ys = useDerivedValue(() => edgesOf(carve.value, 0, dial.rows, metrics.height))

  const frame = useAnimatedProps(() => ({
    d: frameD(
      xs.value,
      ys.value,
      0,
      0,
      phaseOf(sweep.value, DRAW.outer),
      phaseOf(sweep.value, DRAW.cuts),
    ),
  }))
  const ghost = useAnimatedProps(() => ({
    d: frameD(
      xs.value,
      ys.value,
      GHOST.dx,
      GHOST.dy,
      phaseOf(sweep.value, DRAW.outer),
      phaseOf(sweep.value, DRAW.cuts),
    ),
  }))
  const lines = useAnimatedProps(() => ({
    d: dimensionD(xs.value, ys.value, phaseOf(sweep.value, DRAW.dims)),
  }))
  const arrows = useAnimatedProps(() => ({
    d: arrowsD(xs.value, ys.value),
    opacity: phaseOf(sweep.value, DRAW.marks),
  }))

  const totals = laneTotals(dial, values)
  const box = {
    width: metrics.width + SKETCH_PAD * 2,
    height: metrics.height + SKETCH_PAD * 2,
  }

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -SKETCH_PAD, top: -SKETCH_PAD, ...box }}
      >
        <Svg width={box.width} height={box.height} pointerEvents="none">
          <G transform={`translate(${SKETCH_PAD}, ${SKETCH_PAD})`}>
            <AnimatedPath
              animatedProps={ghost}
              stroke={PRIMARY_INK}
              strokeWidth={GHOST.width}
              strokeOpacity={GHOST.opacity}
              strokeLinecap="round"
              fill="none"
            />
            <AnimatedPath
              animatedProps={frame}
              stroke={PRIMARY_INK}
              strokeWidth={1.8}
              strokeOpacity={0.9}
              strokeLinecap="round"
              fill="none"
            />
            <AnimatedPath
              animatedProps={lines}
              stroke={DIM_INK}
              strokeWidth={0.9}
              strokeLinecap="round"
              fill="none"
            />
            <AnimatedPath animatedProps={arrows} fill={DIM_INK} stroke="none" />
          </G>
        </Svg>
      </View>
      {totals.cols.map((total, lane) => (
        <DimensionLabel
          key={`col-${String(lane)}`}
          side="bottom"
          lane={lane}
          xs={xs}
          ys={ys}
          sweep={sweep}
        >
          {String(total)}
        </DimensionLabel>
      ))}
      {totals.rows.map((total, lane) => (
        <DimensionLabel
          key={`row-${String(lane)}`}
          side="left"
          lane={lane}
          xs={xs}
          ys={ys}
          sweep={sweep}
        >
          {String(total)}
        </DimensionLabel>
      ))}
    </View>
  )
}

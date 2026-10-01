import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, G, Path } from 'react-native-svg'

// The rose in the corner, and the one control on this screen that is not the dial.
//
// It points at true north, always — which is why it is worth looking at. With north pinned
// to the top of the screen it never moves, and the hero turns under it; with the hero's
// heading pinned to the top, the sheet turns and the rose turns with the land, so it is the
// one mark that says which way the country is lying.
//
// Tapping it swaps the two. A rose is where a reader of a map already looks for that.

const SIZE = 34
const R = SIZE / 2

// Eight arms: the four cardinals long, the four between them short. Drawn as kites from the
// centre so the rose reads as a rose rather than as a star.
const arm = (angle: number, length: number, waist: number): string => {
  const tip = { x: Math.cos(angle) * length, y: Math.sin(angle) * length }
  const left = {
    x: Math.cos(angle - Math.PI / 2) * waist,
    y: Math.sin(angle - Math.PI / 2) * waist,
  }
  const right = {
    x: Math.cos(angle + Math.PI / 2) * waist,
    y: Math.sin(angle + Math.PI / 2) * waist,
  }
  const n = (v: number) => Math.round(v * 10) / 10
  return `M0 0 L${n(left.x)} ${n(left.y)} L${n(tip.x)} ${n(tip.y)} L${n(right.x)} ${n(right.y)} Z`
}

const CARDINALS = [0, 1, 2, 3].map((i) =>
  arm((i / 4) * Math.PI * 2 - Math.PI / 2, R - 2, 2.6),
)
const DIAGONALS = [0, 1, 2, 3].map((i) =>
  arm(((i + 0.5) / 4) * Math.PI * 2 - Math.PI / 2, (R - 2) * 0.54, 1.8),
)

// The north point, drawn as the lily every chart has had on it for five hundred years: a
// long spine with two lobes at its foot.
const LILY =
  `M0 ${-(R + 3)} L2.8 ${-R * 0.52} L0 ${-R * 0.3} L-2.8 ${-R * 0.52} Z` +
  `M0 ${-R * 0.34} L4.6 ${-R * 0.1} L0 ${R * 0.12} L-4.6 ${-R * 0.1} Z`

export function CompassRose({
  // How far the sheet has been turned, in radians. The rose turns with it, so it goes on
  // pointing north however the land is lying.
  turn,
  northUp,
  line,
  hatch,
  knockout,
  onToggle,
}: {
  turn: SharedValue<number>
  northUp: boolean
  line: string
  hatch: string
  knockout: string
  onToggle: () => void
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}rad` }],
  }))

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={14}
      accessibilityRole="button"
      // The label says what pressing it does, not what it is: a rose is recognisable, and
      // what a player needs told is that it is a switch.
      accessibilityLabel={
        northUp ? 'Turn the map with the hero' : 'Keep north at the top'
      }
      className="absolute bottom-1 right-1 items-center"
    >
      <Animated.View style={style}>
        <Svg width={SIZE + 10} height={SIZE + 10}>
          <G transform={`translate(${(SIZE + 10) / 2}, ${(SIZE + 10) / 2})`}>
            <Circle r={R - 1} fill={knockout} stroke={hatch} strokeWidth={0.7} />
            {DIAGONALS.map((d, i) => (
              <Path
                key={`d-${i}`}
                d={d}
                fill={knockout}
                stroke={hatch}
                strokeWidth={0.7}
              />
            ))}
            {CARDINALS.map((d, i) => (
              <Path
                key={`c-${i}`}
                d={d}
                fill={knockout}
                stroke={line}
                strokeWidth={0.8}
              />
            ))}
            <Path d={LILY} fill={line} stroke={line} strokeWidth={0.6} />
          </G>
        </Svg>
      </Animated.View>
      {/* Which way it is working, in a word. Outside the turning part, so it stays
          readable whichever way the land is lying. */}
      <View className="mt-0.5">
        <Text
          selectable={false}
          className="font-mono text-[7px] font-bold tracking-[1px] text-dim"
        >
          {northUp ? 'NORTH' : 'AHEAD'}
        </Text>
      </View>
    </Pressable>
  )
}

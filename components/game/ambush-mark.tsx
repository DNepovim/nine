import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { tiltedAt, type Sheet } from '@/lib/arcade-tilt'

// The mark on a road the hero has already met bandits on: crossed sabres, at the point along
// it where they are waiting.
//
// It exists because an ambush may only be a surprise once. The first time, nothing on the
// fan says a road is held — that is what an ambush *is*, and it is the one place arcade
// bends its own rule that a crossroad says everything before it is dialled. But a player
// driven back off a road and offered it again is being asked a question, not shown the same
// trap twice: this is the toll written on the map so that walking it again is a decision.
//
// Drawn where the fight springs rather than at either end of the way, so the mark says where
// as well as what: a short road and a long one are held at the same fraction of themselves,
// and the sabres sit on the ground the hero will actually be standing on.

// The box the symbol is drawn in, and the disc inside it that clears the road for it. Small:
// this is a mark on a line, not a thing at the end of one — a town is twice this across, and
// the two should never be confused at a glance.
const BOX = 20
const MID = BOX / 2
const DISC = 6.6

// One sabre, from hilt to tip, bowed a little along its length. Drawn once and mirrored,
// which is what makes the two cross at the middle of the disc rather than merely overlap.
const REACH = 6.2
const BOW = 1.6
const SABRE =
  `M${MID - REACH} ${MID + REACH} ` +
  `Q${MID - BOW} ${MID - BOW} ${MID + REACH} ${MID - REACH}`

export function AmbushMark({
  x,
  y,
  sheet,
  face,
  line,
}: {
  // Where on the canvas the fight springs, in the frame the whole sheet is laid out in.
  x: number
  y: number
  // The camera. The mark lies on the map, so it takes the tilt — it is as far off as the
  // road it is drawn on — but its turn is taken back out, because crossed sabres hanging at
  // whatever angle the sheet happens to be lying at would read as a scribble rather than as
  // a symbol. The same split a town is drawn under.
  sheet: SharedValue<Sheet>
  face: string
  line: string
}) {
  const style = useAnimatedStyle(() => {
    const lie = tiltedAt(sheet.value, x, y)
    return {
      transform: [
        { translateX: lie.x - x },
        { translateY: lie.y - y },
        { rotate: `${-sheet.value.turn}rad` },
        { scale: lie.scale },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x - MID, top: y - MID, width: BOX, height: BOX },
        style,
      ]}
    >
      <Svg width={BOX} height={BOX}>
        {/* The ground under the symbol, knocked out of the road so the sabres are read
            against the sheet rather than against the line they are standing on. */}
        <Circle cx={MID} cy={MID} r={DISC} fill={face} />
        <Path
          d={SABRE}
          fill="none"
          stroke={line}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Path
          d={SABRE}
          fill="none"
          stroke={line}
          strokeWidth={1.4}
          strokeLinecap="round"
          // The same blade turned over, so the pair cross at the middle of the disc.
          transform={`scale(-1, 1) translate(${-BOX}, 0)`}
        />
      </Svg>
    </Animated.View>
  )
}

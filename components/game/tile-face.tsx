import Svg, { Path } from 'react-native-svg'

import { tileAt } from '@/lib/tile-motif'

// One painted tile of the azulejo panel: the tile's pattern at one level, in one `ink`, on
// whatever it is drawn over. A key stacks two of these and fades between them, a wall tile
// stands as one; `centre` paints the middle too, where there is no digit to leave it clear for.
export function TileFace({
  index,
  level,
  ink,
  centre = false,
}: {
  index: number
  level: number
  ink: string
  centre?: boolean
}) {
  const { fill, stroke } = tileAt(index, level, centre)
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path d={fill} fill={ink} />
      <Path d={stroke} fill="none" stroke={ink} strokeWidth={1.6} />
    </Svg>
  )
}

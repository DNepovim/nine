import { useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { TileFace } from '@/components/game/tile-face'
import { AZULEJO } from '@/constants/colors'
import { useTileGrid, useTileInk } from '@/hooks/use-tile-grid'
import { useViewport } from '@/hooks/use-viewport'
import { mixHex } from '@/lib/mix-hex'
import { TOP_LEVEL } from '@/lib/tile-motif'

// FOUR BY FOUR's wall: the whole screen tiled in painted azulejos, in the challenge's own colour,
// on the grid the dial's keys are tiles of. Drawn behind everything while the run is on, and as
// the opening's own scene while its tiles are being laid — `sweep` is how far the wave from the
// top-left corner has got, or null for a wall that is simply there.
//
// The dial reports where it stands (`useTileGrid`), and the wall is cut to its pitch and shifted
// until a cell of it is the dial's; until it has, the wall is cut to a plain pitch off the corner.
// The tile at a place is the same whichever way the wave runs, so a wall that is re-laid is the
// same wall.

// How much of the wave one tile takes to land, the rest being its delay.
const SETTLE = 0.35
// Wall tiles are painted between these levels, by place, so the wall has fullness and quiet.
const LEAST = 4

// Which tile and how full, from a cell's place on the wall — a spread, not a pattern.
const tileOfCell = (col: number, row: number) => ({
  index: (((col * 5 + row * 3) % 16) + 16) % 16,
  level: LEAST + ((((col * 7 + row * 11) % 6) + 6) % 6) * ((TOP_LEVEL - LEAST) / 5),
})

function WallTile({
  size,
  left,
  top,
  at,
  sweep,
  index,
  level,
  ink,
}: {
  size: number
  left: number
  top: number
  // Where in the wave this tile lands, nought to one.
  at: number
  sweep: SharedValue<number> | null
  index: number
  level: number
  ink: string
}) {
  const style = useAnimatedStyle(() => {
    if (sweep === null) return { opacity: 1 }
    const landed = Math.min(1, Math.max(0, (sweep.value - at * (1 - SETTLE)) / SETTLE))
    return { opacity: landed, transform: [{ scale: 0.7 + 0.3 * landed }] }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: size,
          height: size,
          backgroundColor: AZULEJO.glaze,
          borderWidth: 1,
          borderColor: mixHex(ink, AZULEJO.glaze, 0.7),
        },
        style,
      ]}
    >
      <TileFace index={index} level={level} ink={ink} centre />
    </Animated.View>
  )
}

export function TileWall({ sweep = null }: { sweep?: SharedValue<number> | null }) {
  const { width, height } = useViewport()
  const grid = useTileGrid()
  const ink = useTileInk()
  const box = useRef<View>(null)
  // Where this layer starts on the window, which the dial's report is measured against.
  const [origin, setOrigin] = useState({ x: 0, y: 0 })

  const size = grid?.size ?? Math.round(width / 5)
  // The first cell's corner, kept a whole cell off the edge so the wall has no bare strip.
  const start = (reported: number | undefined, from: number) =>
    reported === undefined ? 0 : ((((reported - from) % size) + size) % size) - size
  const x0 = start(grid?.x, origin.x)
  const y0 = start(grid?.y, origin.y)
  const cols = Math.ceil((width - x0) / size)
  const rows = Math.ceil((height - y0) / size)
  const span = cols + rows - 2 || 1
  // Counted from the dial's own cell, so a tile keeps its pattern whichever corner the wall is
  // cut from.
  const dialCol = grid === null ? 0 : Math.round((grid.x - origin.x - x0) / size)
  const dialRow = grid === null ? 0 : Math.round((grid.y - origin.y - y0) / size)

  return (
    <View
      ref={box}
      className="absolute inset-0 overflow-hidden"
      pointerEvents="none"
      aria-hidden
      onLayout={() => {
        box.current?.measureInWindow((x, y) => {
          setOrigin((was) => (was.x === x && was.y === y ? was : { x, y }))
        })
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const { index, level } = tileOfCell(c - dialCol, r - dialRow)
          return (
            <WallTile
              key={`${r}:${c}`}
              size={size}
              left={x0 + c * size}
              top={y0 + r * size}
              at={(r + c) / span}
              sweep={sweep}
              index={index}
              level={level}
              ink={ink}
            />
          )
        }),
      )}
    </View>
  )
}

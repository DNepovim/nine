import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import type { ComponentProps } from 'react'
import { View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { TargetCard } from '@/components/game/target-card'
import { TileFace } from '@/components/game/tile-face'
import { AZULEJO, TARGET_BAND_TRACK } from '@/constants/colors'
import { useTileGrid, useTileInk } from '@/hooks/use-tile-grid'
import { useViewport } from '@/hooks/use-viewport'
import { targetBand } from '@/lib/target-band'
import { TOP_LEVEL } from '@/lib/tile-motif'
import { snapToGrid, type Spot } from '@/lib/tile-snap'

// A target as a tile of the wall: the `tiled` **target form**, FOUR BY FOUR's. The target is dealt
// where it is dealt and then stands on the nearest cell of the wall's grid — the keys' grid — as
// a tile painted full in glaze on the challenge's own colour, with the ordinary card, its ring
// and its number, in a round at the middle.

// How much of the tile the card takes, the rest being the painted border round it.
const ROUND = 0.66

const BoardOrigin = createContext<Spot>({ x: 0, y: 0 })

// What stands round the targets: nothing drawn, but it knows where on the window the board starts,
// which the cells are measured against.
export function TileBoard({ children }: { children: ReactNode }) {
  const box = useRef<View>(null)
  const [origin, setOrigin] = useState<Spot>({ x: 0, y: 0 })
  return (
    <View
      ref={box}
      className="absolute inset-0"
      pointerEvents="box-none"
      onLayout={() => {
        box.current?.measureInWindow((x, y) => {
          setOrigin((was) => (was.x === x && was.y === y ? was : { x, y }))
        })
      }}
    >
      <BoardOrigin.Provider value={origin}>{children}</BoardOrigin.Provider>
    </View>
  )
}

export function TiledTarget(props: ComponentProps<typeof TargetCard>) {
  const { target, maxValue, color } = props
  const grid = useTileGrid()
  const ink = useTileInk()
  const board = useContext(BoardOrigin)
  const { width } = useViewport()
  const cell = grid?.size
  // Until the dial has said where the grid is, the target stands where it was dealt.
  const spot =
    grid === null || cell === undefined
      ? target.position
      : snapToGrid({ at: target.position, board, grid, size: cell, width })
  const round = (cell ?? 80) * ROUND
  const inset = ((cell ?? 80) - round) / 2
  return (
    <>
      <Animated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(260)}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: spot.x,
          top: spot.y,
          width: cell ?? 80,
          height: cell ?? 80,
          backgroundColor: ink,
        }}
      >
        <TileFace index={target.seq} level={TOP_LEVEL} ink={AZULEJO.glaze} />
      </Animated.View>
      <TargetCard
        {...props}
        target={{ ...target, position: { x: spot.x + inset, y: spot.y + inset } }}
        size={round}
        color={color ?? TARGET_BAND_TRACK[targetBand(target.value * 10, maxValue * 10)]}
      />
    </>
  )
}

import type { ComponentProps } from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { ChipDrum, type DrumRound } from '@/components/game/chip-drum'
import { TargetCard } from '@/components/game/target-card'
import { CASINO_CHIP } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'

// A target as a casino chip: the `chips` **target form**, REELS'.
//
// The disc is `PieCountdown`'s orb in the chip's own colours — a deep red ground, a gold rim and
// the clock a gold arc round it — and this form lays on what makes it a chip: a ring of notches
// just inside the rim, cut the way a chip's edge is. Its number is drums (`ChipDrum`) that spin to rest on arrival and on a hit. Drawing
// only; the contract is the disc's.

// How far in from the edge the notches run, and how long each notch and the gap between are.
const NOTCH_INSET = 6.5
const NOTCH_WIDTH = 3.5
const NOTCHES = 16

export function ChipTarget(props: ComponentProps<typeof TargetCard>) {
  const { target, size = PIE_SIZE } = props
  const radius = size / 2 - NOTCH_INSET
  const circumference = 2 * Math.PI * radius
  const notch = circumference / NOTCHES
  // A chip dealt now arrives on its drums; one put back mid-clock has had its arrival.
  const round: DrumRound =
    target.exit === 'hit' ? 'hit' : target.startProgress === 1 ? 'arrive' : 'rest'
  return (
    <>
      <TargetCard orb={CASINO_CHIP} {...props} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: target.position.x,
          top: target.position.y,
          width: size,
          height: size,
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={CASINO_CHIP.notch}
            strokeOpacity={0.5}
            strokeWidth={NOTCH_WIDTH}
            strokeDasharray={`${notch * 0.45} ${notch * 0.55}`}
            fill="none"
          />
        </Svg>
        <ChipDrum
          value={target.takenAt ?? target.value}
          seq={target.seq}
          size={size}
          round={round}
        />
      </View>
    </>
  )
}

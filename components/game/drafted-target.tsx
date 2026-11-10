import type { ComponentProps } from 'react'

import { TargetCard } from '@/components/game/target-card'
import { TARGET_BAND_TRACK } from '@/constants/colors'
import { targetBand } from '@/lib/target-band'

// A target as a circle ruled in pencil and coloured in: the `drafted` **target form**,
// FOUR KEYS'. The card is the ordinary one, drawn (`drawn` on `PieCountdown`).
//
// Coloured by the target's leading figure, as every disc is — a colour is read before a
// number — but one place down. The app tints by hundreds, and on a dial whose sums stop at
// 81 that is the same pale grey for every target there is; the tens are what tell one from
// another here, in the same pastels, so 23 and 63 cannot pass for each other.
export function DraftedTarget(props: ComponentProps<typeof TargetCard>) {
  const { target, maxValue, color } = props
  return (
    <TargetCard
      {...props}
      drawn
      color={color ?? TARGET_BAND_TRACK[targetBand(target.value * 10, maxValue * 10)]}
    />
  )
}

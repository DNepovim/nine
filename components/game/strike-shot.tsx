import { useEffect } from 'react'
import { View } from 'react-native'

import { BurstRound } from '@/components/game/burst-round'
import { StrikeBeam } from '@/components/game/strike-beam'
import {
  BEAM_END_CLEARANCE,
  BEAM_START_GAP,
  BURST_MS,
  burstRounds,
  insetLine,
  shotLine,
  SNIPER_MS,
  type ShotKind,
} from '@/lib/strike-shot'

// How long each shot owns its slot on the layer. Both are shorter than the gap between
// two hits at the hardest cadence their mode runs, so a shot is never still on screen
// when the next one is fired.
const SHOT_MS = {
  sniper: SNIPER_MS,
  burst: BURST_MS,
} as const satisfies Record<ShotKind, number>

// One strike's shot, from the sum row to the target it took. Positions the anchor both
// kinds of line are laid out from — every line inside runs along +X from here — and
// owns the shot's lifetime, so the lines themselves only have to draw.
export function StrikeShot({
  kind,
  fromX,
  fromY,
  toX,
  toY,
  radius,
  rounds,
  onDone,
}: {
  kind: ShotKind
  fromX: number
  fromY: number
  toX: number
  toY: number
  // Half the target's footprint — how wide a burst may spread across its face.
  radius: number
  // Which rounds of the press's one burst this target gets. Empty for a sniper, which
  // fires one beam and nothing else.
  rounds: readonly number[]
  onDone: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOT_MS[kind])
    return () => {
      clearTimeout(timer)
    }
  }, [])

  const from = { x: fromX, y: fromY }
  const to = { x: toX, y: toY }

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: fromX, top: fromY }}>
      {kind === 'sniper' ? (
        // The beam is aimed at the target's middle but drawn short of it at both ends:
        // clear of the digits it leaves, and clear of the rim it is aimed at.
        <StrikeBeam
          angle={shotLine(from, to).angle}
          {...insetLine(
            shotLine(from, to).length,
            BEAM_START_GAP,
            radius + BEAM_END_CLEARANCE,
          )}
        />
      ) : (
        burstRounds(from, to, radius, rounds).map((round) => (
          <BurstRound
            key={round.delay}
            length={round.length}
            angle={round.angle}
            delay={round.delay}
          />
        ))
      )}
    </View>
  )
}

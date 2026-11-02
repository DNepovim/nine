import { useEffect } from 'react'
import { View } from 'react-native'

import { BurstRound } from '@/components/game/burst-round'
import { StrikeBeam } from '@/components/game/strike-beam'
import type { Shot } from '@/hooks/use-strike-shots'
import {
  BEAM_END_CLEARANCE,
  BURST_MS,
  burstRounds,
  insetLine,
  shotLine,
  SNIPER_MS,
  sniperStartGap,
  SUM_TOP,
} from '@/lib/strike-shot'

type Kind = Shot['kind']

// How long each shot owns its slot on the layer. Both are shorter than the gap between
// two hits at the hardest cadence their mode runs, so a shot is never still on screen
// when the next one is fired.
const SHOT_MS = {
  sniper: SNIPER_MS,
  burst: BURST_MS,
  // The chain is the sniper's beam with both ends moved, so it owns its slot for exactly
  // as long. One timing rather than two within ten milliseconds of each other: nobody can
  // see the difference and a second constant is a second thing to keep true.
  chain: SNIPER_MS,
} as const satisfies Record<Kind, number>

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
  sumDigits,
  rounds,
  onDone,
}: {
  kind: Kind
  fromX: number
  fromY: number
  toX: number
  toY: number
  // Half the target's footprint — how wide a burst may spread across its face.
  radius: number
  // How many digits the sum stood at when the shot was fired, for a sniper's start gap.
  sumDigits: number
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

  // A sniper leaves from the top centre of the sum rather than the row's middle — see
  // SUM_TOP. The other kinds keep the row's middle: a burst's rounds start a tenth of
  // the way out already, and a chain leaves the card it took last.
  const from = { x: fromX, y: kind === 'sniper' ? fromY - SUM_TOP : fromY }
  const to = { x: toX, y: toY }
  const ray = shotLine(from, to)
  const endGap = radius + BEAM_END_CLEARANCE
  // How far the beam starts from its muzzle. A sniper clears the sum's digits, by a
  // distance that turns on the beam's angle and the number's width — see
  // sniperStartGap. A chain leaves the card it took last, so it clears that card's rim
  // exactly as it clears the rim it is aimed at. The first chain beam of a run has no
  // previous card and leaves the sum row's middle instead, a card's radius out — further
  // than a sniper starts, and only ever once a run.
  const startGap = kind === 'sniper' ? sniperStartGap(ray.angle, sumDigits) : endGap

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: from.x, top: from.y }}
    >
      {kind !== 'burst' ? (
        // The beam is aimed at the target's middle but drawn short of it at both ends:
        // clear of the digits it leaves, and clear of the rim it is aimed at.
        <StrikeBeam angle={ray.angle} {...insetLine(ray.length, startGap, endGap)} />
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

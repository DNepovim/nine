import { useEffect } from 'react'
import { View } from 'react-native'

import { BurstRound } from '@/components/game/burst-round'
import { StrikeBeam } from '@/components/game/strike-beam'
import type { Shot } from '@/hooks/use-strike-shots'
import {
  BEAM_END_CLEARANCE,
  BEAM_START_GAP,
  BURST_MS,
  burstRounds,
  insetLine,
  shotLine,
  SNIPER_MS,
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

// How far a beam of each kind starts from its muzzle.
//
// A sniper leaves the sum row and has to clear the digits standing there. A chain leaves
// the card it took last, so it clears that card's rim exactly as it clears the rim it is aimed at —
// which makes the start gap the one value this map cannot hold, since it depends on how
// big the card is. `-1` asks for the radius; see the call below.
const RIM = -1
const START_GAP = {
  sniper: BEAM_START_GAP,
  chain: RIM,
} as const satisfies Record<Exclude<Kind, 'burst'>, number>

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
  kind: Kind
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
      {kind !== 'burst' ? (
        // The beam is aimed at the target's middle but drawn short of it at both ends:
        // clear of the digits it leaves, and clear of the rim it is aimed at.
        <StrikeBeam
          angle={shotLine(from, to).angle}
          {...insetLine(
            shotLine(from, to).length,
            // See `START_GAP`: a sniper clears the sum's digits, a chain clears the rim
            // of the card it came from. The
            // first chain beam of a run has no previous card and leaves the sum row
            // instead — eight points further out than a sniper would, which is not a
            // difference anybody can see.
            START_GAP[kind] === RIM ? radius + BEAM_END_CLEARANCE : START_GAP[kind],
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

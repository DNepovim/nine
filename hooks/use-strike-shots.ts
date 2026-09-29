import { isNonEmptyArray } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import { MODE_SHOT, shareRounds, type Point, type ShotKind } from '@/lib/strike-shot'
import type { HitBatch } from '@/machines/game'
import type { Mode } from '@/machines/modes'

// Where a shot leaves from and what it is aimed at, both in the effect layer's own
// coordinates.
export type ShotAim = { from: Point; to: Point }

// A shot in flight. Its geometry is fixed the instant it is fired rather than read each
// frame: the target is already playing its exit by then, and following it would have the
// beam chase a card that is no longer where it was hit.
export type Shot = ShotAim & {
  id: number
  kind: ShotKind
  // Which rounds of the press's one burst this shot fires — see shareRounds.
  rounds: number[]
}

// Turns the strikes in a hit batch into shots for the board to draw. A strike is a hit
// that landed on a live multiplier; Trainee fires none, whatever its multiplier says,
// because its multiplier is the legacy board-clear rule rather than a chain the player
// built.
export function useStrikeShots({
  mode,
  hitBatch,
  aim,
}: {
  mode: Mode
  hitBatch: HitBatch
  // Read when a strike lands rather than depended on: it closes over the board's
  // measurements and the targets standing, so it is a new function on every render, and
  // depending on it would re-run this for presses that hit nothing. Answers null while
  // the board has not been measured, or for a target that has already left it.
  aim: (value: number) => ShotAim | null
}) {
  const [shots, setShots] = useState<Shot[]>([])
  const shotId = useRef(0)
  const lastSeq = useRef(hitBatch.seq)
  const aimRef = useRef(aim)
  aimRef.current = aim

  useEffect(() => {
    if (hitBatch.seq === lastSeq.current) return
    lastSeq.current = hitBatch.seq
    const kind = MODE_SHOT[mode]
    if (kind === null) return
    // Never the hit that cost a life: Accuracy only multiplies when every hit in the
    // press was optimal, and an optimal hit is not a wasteful one.
    const strikes = hitBatch.hits.filter((hit) => hit.bonus)
    if (!isNonEmptyArray(strikes)) return
    const share = shareRounds(strikes.length)
    const fired = strikes.flatMap((hit, index) => {
      const aimed = aimRef.current(hit.value)
      if (aimed === null) return []
      return [{ id: ++shotId.current, kind, rounds: share[index] ?? [], ...aimed }]
    })
    if (!isNonEmptyArray(fired)) return
    setShots((prev) => [...prev, ...fired])
  }, [hitBatch, mode])

  const removeShot = (id: number) => {
    setShots((prev) => prev.filter((shot) => shot.id !== id))
  }

  return { shots, removeShot }
}

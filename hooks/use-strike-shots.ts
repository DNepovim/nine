import { isNonEmptyArray } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import { shareRounds, type Point } from '@/lib/strike-shot'
import type { HitBatch } from '@/machines/game'
import { gradientOf, modeById, type ModeId, type ShotKind } from '@/modes'

// Where a shot leaves from and what it is aimed at, both in the effect layer's own
// coordinates.
export type ShotAim = {
  from: Point
  to: Point
  // Where a **quartet** fires from: the centre of every key on the dial. Absent for the
  // two shots that leave from the sum row, which is every other mode's.
  //
  // On the aim rather than worked out here, because the screen is what has measured the
  // dial — this hook knows nothing about where anything is drawn.
  muzzles?: readonly Point[]
}

// A shot in flight. Its geometry is fixed the instant it is fired rather than read each
// frame: the target is already playing its exit by then, and following it would have the
// beam chase a card that is no longer where it was hit.
export type Shot = {
  id: number
  kind: ShotKind
  from: Point
  to: Point
  // Which rounds of the press's one burst this shot fires — see shareRounds.
  rounds: number[]
  // The two stops this shot's beam is drawn in, where the mode wants its own. Only a
  // quartet sets it; the rest take the shot layer's default.
  gradient?: readonly [string, string]
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
  mode: ModeId
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
    const kind = modeById(mode)?.shot ?? null
    if (kind === null) return
    // A quartet is a challenge's shot, so it is drawn in that challenge's own colour —
    // see the `gradient` prop on `StrikeBeam`. Every other shot takes the layer's own.
    const gradient = kind === 'quartet' ? gradientOf(mode) : undefined
    // Never the hit that cost a life: Accuracy only multiplies when every hit in the
    // press was optimal, and an optimal hit is not a wasteful one.
    const strikes = hitBatch.hits.filter((hit) => hit.bonus)
    if (!isNonEmptyArray(strikes)) return
    const share = shareRounds(strikes.length)
    const fired = strikes.flatMap((hit, index) => {
      const aimed = aimRef.current(hit.value)
      if (aimed === null) return []
      const rounds = share[index] ?? []
      // A quartet is one strike drawn as several shots — a beam from each key, all
      // aimed at the same card. Fanned out here rather than inside the drawing, so the
      // layer keeps drawing one line per shot and the shape of the thing lives in one
      // place. A quartet with no muzzles measured yet falls back to the single line
      // every other shot fires, which is a beam from the sum row rather than nothing.
      const muzzles = kind === 'quartet' ? (aimed.muzzles ?? []) : []
      if (isNonEmptyArray(muzzles)) {
        return muzzles.map((from) => ({
          id: ++shotId.current,
          kind,
          rounds,
          from,
          to: aimed.to,
          gradient,
        }))
      }
      return [
        {
          id: ++shotId.current,
          kind,
          rounds,
          from: aimed.from,
          to: aimed.to,
          gradient,
        },
      ]
    })
    if (!isNonEmptyArray(fired)) return
    setShots((prev) => [...prev, ...fired])
  }, [hitBatch, mode])

  const removeShot = (id: number) => {
    setShots((prev) => prev.filter((shot) => shot.id !== id))
  }

  return { shots, removeShot }
}

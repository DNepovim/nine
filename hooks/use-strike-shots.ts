import { isNonEmptyArray } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import { shareRounds, type Point } from '@/lib/strike-shot'
import type { HitBatch } from '@/machines/game'
import { modeById, type ModeId, type ShotKind } from '@/modes'

// Where a shot leaves from and what it is aimed at, both in the effect layer's own
// coordinates.
export type ShotAim = {
  from: Point
  to: Point
  // Half the card this shot is aimed at. On its own rather than a constant at the
  // drawing, because a **drilled** run draws its nine at nine different sizes — a beam
  // inset by half of some other card's width stops short of its target or lands inside
  // it.
  radius: number
  // How many digits the sum stands at when the shot leaves it — a sniper starts clear of
  // the number's outline, and that outline is as wide as the number is long.
  sumDigits: number
}

// A shot in flight. Its geometry is fixed the instant it is fired rather than read each
// frame: the target is already playing its exit by then, and following it would have the
// beam chase a card that is no longer where it was hit.
export type Shot = {
  id: number
  // Never a flame, which burns under the dial, nor steps, which are kept on the floor — neither
  // is a shot on this layer.
  kind: Exclude<ShotKind, 'flame' | 'steps'>
  from: Point
  to: Point
  // Half the card it was aimed at, fixed with the rest of the geometry the instant the
  // shot was fired.
  radius: number
  // The sum's length the instant it was fired — see ShotAim.
  sumDigits: number
  // Which rounds of the press's one burst this shot fires — see shareRounds.
  rounds: number[]
}

// One leg of a **steps** run's trail: the footprints between the target taken before and the one
// taken now. Fixed, like a shot's geometry, the instant the hit lands.
export type Leg = {
  id: number
  from: Point
  to: Point
  radius: number
  // Whether this leg was a strike, which slides on fire where the others only appear.
  burning: boolean
}

// Turns the strikes in a hit batch into shots for the board to draw — or, for a mode
// whose shot is a `flame`, into the cue that sets every key alight. A strike is a hit
// that landed on a live multiplier; Trainee fires none, whatever its multiplier says,
// because its multiplier is the legacy board-clear rule rather than a chain the player
// built.
export function useStrikeShots({
  mode,
  runSeq,
  hitBatch,
  aim,
}: {
  mode: ModeId
  // Which run these strikes belong to. A **chain** fires from the card it took last, and
  // the first strike of a run has no last card — so the memory has to be dropped on a
  // fresh deal, or the first beam of a new run would be drawn from a card that was
  // standing on the board before it.
  runSeq: number
  hitBatch: HitBatch
  // Read when a strike lands rather than depended on: it closes over the board's
  // measurements and the targets standing, so it is a new function on every render, and
  // depending on it would re-run this for presses that hit nothing. Answers null while
  // the board has not been measured, or for a target that has already left it.
  aim: (value: number) => ShotAim | null
}) {
  const [shots, setShots] = useState<Shot[]>([])
  // How many presses have set the dial alight — the `flame` shot. One per press that
  // struck, not one per strike: a press that takes two cards burns once. Null for every
  // mode whose shot is not a flame.
  const [flame, setFlame] = useState<number | null>(null)
  // The legs a `steps` run has walked, oldest first. Emptied on a fresh run; empty for every
  // other shot.
  const [legs, setLegs] = useState<Leg[]>([])
  const shotId = useRef(0)
  const lastSeq = useRef(hitBatch.seq)
  // Where the last strike landed, which is where the next **chain** beam leaves from.
  // Null at the start of every run, and advanced through a multi-target press in the
  // order the strikes were drawn — so one press that clears three cards draws the route
  // between them rather than three beams from the same place.
  const chainFrom = useRef<Point | null>(null)
  const lastRun = useRef(runSeq)
  const aimRef = useRef(aim)
  aimRef.current = aim

  useEffect(() => {
    if (runSeq !== lastRun.current) {
      lastRun.current = runSeq
      chainFrom.current = null
      setLegs([])
    }
    if (hitBatch.seq === lastSeq.current) return
    lastSeq.current = hitBatch.seq
    const kind = modeById(mode)?.shot ?? null
    if (kind === null) return
    if (kind === 'steps') {
      // Every hit leaves a leg, not only a strike: the route is the thing being learnt, and it
      // is only whole if no hit of it is missing. A strike is the leg that burns.
      const walked = hitBatch.hits.flatMap((hit) => {
        const aimed = aimRef.current(hit.value)
        if (aimed === null) return []
        const from = chainFrom.current ?? aimed.from
        chainFrom.current = aimed.to
        return [
          {
            id: ++shotId.current,
            from,
            to: aimed.to,
            radius: aimed.radius,
            burning: hit.bonus,
          },
        ]
      })
      if (isNonEmptyArray(walked)) setLegs((prev) => [...prev, ...walked])
      return
    }
    // Never the hit that cost a life: Accuracy only multiplies when every hit in the
    // press was optimal, and an optimal hit is not a wasteful one.
    const strikes = hitBatch.hits.filter((hit) => hit.bonus)
    if (!isNonEmptyArray(strikes)) return
    if (kind === 'flame') {
      setFlame((prev) => (prev ?? 0) + 1)
      return
    }
    const share = shareRounds(strikes.length)
    const fired = strikes.flatMap((hit, index) => {
      const aimed = aimRef.current(hit.value)
      if (aimed === null) return []
      const rounds = share[index] ?? []
      // A chain leaves the card taken before this one, falling back to the sum row for
      // the first strike of a run. Advanced here rather than in `aim`, because which
      // end a beam leaves from is a fact about the shot kind and `aim` only knows where
      // things are.
      const from = kind === 'chain' ? (chainFrom.current ?? aimed.from) : aimed.from
      if (kind === 'chain') chainFrom.current = aimed.to
      return [
        {
          id: ++shotId.current,
          kind,
          rounds,
          from,
          to: aimed.to,
          radius: aimed.radius,
          sumDigits: aimed.sumDigits,
        },
      ]
    })
    if (!isNonEmptyArray(fired)) return
    setShots((prev) => [...prev, ...fired])
  }, [hitBatch, mode, runSeq])

  const removeShot = (id: number) => {
    setShots((prev) => prev.filter((shot) => shot.id !== id))
  }

  return { shots, removeShot, flame, legs }
}

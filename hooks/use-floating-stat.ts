import { useEffect, useRef, useState } from 'react'

import type { HitBatch } from '@/machines/game'
import type { Headline } from '@/modes'

type FloatingStatItem = { id: number; value: number; progress: number }

// The figure that floats off a hit: whichever of the two factors the mode is about.
//
// The factor rather than the mode's name — see `headline` on ScoringRules, which is the
// half of its blend a mode weighs more. Only drawn where there is a score beside it, so
// an unscored run never asks.
export function useFloatingStat(hitBatch: HitBatch, headline: Headline) {
  const [floatStats, setFloatStats] = useState<FloatingStatItem[]>([])
  const floatId = useRef(0)
  const lastHitSeq = useRef(0)

  useEffect(() => {
    if (hitBatch.seq === lastHitSeq.current || hitBatch.hits.length === 0) return
    lastHitSeq.current = hitBatch.seq
    setFloatStats((prev) => [
      ...prev,
      ...hitBatch.hits.map((hit) => ({
        id: ++floatId.current,
        value: Math.round(100 * (headline === 'acc' ? hit.accFactor : hit.spdFactor)),
        progress: hit.progress,
      })),
    ])
  }, [hitBatch, headline])

  const removeFloatStat = (id: number) => {
    setFloatStats((prev) => prev.filter((f) => f.id !== id))
  }

  return { floatStats, removeFloatStat }
}

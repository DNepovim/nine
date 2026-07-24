import { useEffect, useRef, useState } from 'react'

import type { HitBatch } from '@/machines/game'
import type { Mode } from '@/machines/modes'

type FloatingStatItem = { id: number; value: number; progress: number }

export function useFloatingStat(hitBatch: HitBatch, mode: Mode) {
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
        value: Math.round(100 * (mode === 'accuracy' ? hit.accFactor : hit.spdFactor)),
        progress: hit.progress,
      })),
    ])
  }, [hitBatch, mode])

  const removeFloatStat = (id: number) => {
    setFloatStats((prev) => prev.filter((f) => f.id !== id))
  }

  return { floatStats, removeFloatStat }
}

import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { type HitBatch, type HitInfo } from '@/machines/game'

type FloatingPoint = { id: number } & HitInfo

// Turns the machine's hit batch into a list of floating "+points" for the HUD,
// firing success haptics on bonus (board-clear) hits.
export function useFloatingPoints(hitBatch: HitBatch) {
  const [floats, setFloats] = useState<FloatingPoint[]>([])
  const floatId = useRef(0)
  const lastHitSeq = useRef(0)

  useEffect(() => {
    if (hitBatch.seq === lastHitSeq.current || hitBatch.hits.length === 0) return
    lastHitSeq.current = hitBatch.seq
    setFloats((prev) => [
      ...prev,
      ...hitBatch.hits.map((hit) => ({ id: ++floatId.current, ...hit })),
    ])
    if (hitBatch.hits.some((hit) => hit.bonus) && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }
  }, [hitBatch])

  const removeFloat = (id: number) => {
    setFloats((prev) => prev.filter((float) => float.id !== id))
  }

  return { floats, removeFloat }
}

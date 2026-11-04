import { useEffect, useRef, useState, type RefObject } from 'react'
import type { View } from 'react-native'

import { PIE_SIZE } from '@/constants/game'
import { firstToRunOut, lostMark } from '@/lib/lost-mark'
import type { DisplayTarget, Position } from '@/types/game'

// Where this run's lost targets stood, in the window's measure, oldest first: what a mirror
// cracks at. Gathered off the board as targets go, and started again with each run.
export function useLostMarks({
  runId,
  targets,
  lives,
  boardRef,
}: {
  runId: string
  targets: readonly DisplayTarget[]
  lives: number
  boardRef: RefObject<View | null>
}): readonly Position[] {
  const [marks, setMarks] = useState<readonly Position[]>([])
  const seen = useRef(new Set<number>())
  const run = useRef(runId)

  useEffect(() => {
    if (run.current !== runId) {
      run.current = runId
      seen.current = new Set()
      setMarks([])
    }
    const failed = targets.filter((target) => target.exit === 'failed')
    // The last heart's target never picks up an exit: see `firstToRunOut`.
    const last =
      lives > 0 ? null : firstToRunOut(targets.filter((target) => target.exit === null))
    const lost = last === null ? failed : [...failed, last]
    for (const target of lost) {
      if (seen.current.has(target.id)) continue
      seen.current.add(target.id)
      const mark = lostMark(target, PIE_SIZE)
      boardRef.current?.measureInWindow((x, y) => {
        setMarks((all) => [...all, { x: x + mark.x, y: y + mark.y }])
      })
    }
  }, [runId, targets, lives, boardRef])

  return marks
}

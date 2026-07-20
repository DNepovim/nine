import { useEffect, useRef } from 'react'

// Tracks whether the score last moved up (1) or down (-1), driving the digit
// flip direction for the sum above the dial.
export function useScoreDirection(score: number): 1 | -1 {
  const prev = useRef(score)
  const direction: 1 | -1 = score >= prev.current ? 1 : -1
  useEffect(() => {
    prev.current = score
  }, [score])
  return direction
}

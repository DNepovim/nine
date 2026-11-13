import { useEffect, useRef, useState } from 'react'

// Counts the displayed score up to the machine's Score as floating "+points"
// merge in; jumps immediately when the target drops (e.g. new game).
//
// Starts at the figure it is mounted with: a readout that mounts mid-run shows the score
// standing rather than counting up to it again.
export function useDisplayScore(target: number): number {
  const [displayScore, setDisplayScore] = useState(target)
  const displayScoreRef = useRef(target)

  useEffect(() => {
    const from = displayScoreRef.current
    const to = target
    if (from === to) return
    if (to < from) {
      displayScoreRef.current = to
      setDisplayScore(to)
      return
    }
    const start = Date.now()
    const duration = 400
    let raf: number
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      const value = Math.round(from + (to - from) * t)
      displayScoreRef.current = value
      setDisplayScore(value)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [target])

  return displayScore
}

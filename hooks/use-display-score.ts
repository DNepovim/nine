import { useEffect, useRef, useState } from 'react'

// Counts the displayed score up to the machine's Score as floating "+points"
// merge in; jumps immediately when the target drops (e.g. new game).
export function useDisplayScore(target: number): number {
  const [displayScore, setDisplayScore] = useState(0)
  const displayScoreRef = useRef(0)

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

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

type SplashState = { done: boolean; finish: () => void }

const SplashContext = createContext<SplashState>({ done: false, finish: () => {} })

// The intro splash covers the whole app while the screens beneath it are already
// mounted. Anything time-based down there — the tutorial's opening countdown —
// has to wait for this, or it burns through while nobody can see it.
export function SplashProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false)
  const finish = useCallback(() => {
    setDone(true)
  }, [])
  const value = useMemo(() => ({ done, finish }), [done, finish])
  return <SplashContext value={value}>{children}</SplashContext>
}

export function useSplash(): SplashState {
  return use(SplashContext)
}

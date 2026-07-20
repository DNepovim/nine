import { createContext, useContext, useState, type ReactNode } from 'react'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

type ColorScheme = 'light' | 'dark'

const BG_DARK = '#0B0C14'
const BG_LIGHT = '#F3EFE9'

const ThemeContext = createContext<{
  colorScheme: ColorScheme
  toggleTheme: () => void
  transitionOpacity: SharedValue<number>
  transitionColor: string
} | null>(null)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  // Always start in light mode (deterministic across static render + client
  // hydration), then let the user toggle manually. Reading the OS preference
  // here caused an inconsistent first paint where some components rendered dark.
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light')
  const [transitionColor, setTransitionColor] = useState(BG_DARK)

  const transitionOpacity = useSharedValue(0)

  const applyToggle = () => {
    setColorScheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const toggleTheme = () => {
    const targetDark = colorScheme === 'light'
    setTransitionColor(targetDark ? BG_DARK : BG_LIGHT)
    transitionOpacity.value = withTiming(1, { duration: 350 }, (finished) => {
      if (!finished) return
      scheduleOnRN(applyToggle)
      transitionOpacity.value = withTiming(0, { duration: 500 })
    })
  }

  return (
    <ThemeContext.Provider
      value={{ colorScheme, toggleTheme, transitionOpacity, transitionColor }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside AppThemeProvider')
  return ctx
}

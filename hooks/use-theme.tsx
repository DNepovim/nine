import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Appearance, Platform } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { SURFACE } from '@/constants/colors'

type ColorScheme = 'light' | 'dark'

const BG_DARK = SURFACE.dark
const BG_LIGHT = SURFACE.light

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
  // Annotated: SURFACE is `as const`, so an inferred state would lock to one hex.
  const [transitionColor, setTransitionColor] = useState<string>(BG_DARK)

  const transitionOpacity = useSharedValue(0)

  // Drive the token color scheme. On web, react-native-web has no
  // Appearance.setColorScheme, so toggle the `.dark` class on the document root
  // (which activates the class-based dark CSS). On native, set the Appearance
  // scheme (react-native-css resolves `.dark:root` variables from it).
  //
  // The same moment owns the `theme-color` tag, which is the only say we get over
  // the chrome the phone draws around us: Safari's top bar, and the status bar over
  // an installed app. It is written here rather than declared once in +html.tsx
  // because the scheme is ours to toggle, not the OS's to announce — a media-query
  // tag would answer to the phone's setting and contradict the screen underneath it.
  // Landing mid-cross-fade is right: the overlay is at full opacity in the target
  // colour by then, so the bar changes under cover with everything else.
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', colorScheme === 'dark')
        const themeColor = document.querySelector('meta[name="theme-color"]')
        if (themeColor instanceof HTMLMetaElement) {
          themeColor.content = SURFACE[colorScheme]
        }
      }
    } else {
      Appearance.setColorScheme(colorScheme)
    }
  }, [colorScheme])

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

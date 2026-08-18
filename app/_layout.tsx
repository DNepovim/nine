import 'react-native-url-polyfill/auto'

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from '@react-navigation/native'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import '@/global.css'

import { CrashScreen } from '@/components/crash-screen'
import { PhoneFrame } from '@/components/phone-frame'
import { SplashScreen } from '@/components/splash-screen'
import { AppThemeProvider, useTheme } from '@/hooks/use-theme'
import { captureError, initAnalytics } from '@/lib/analytics'
import { isDesktopViewport } from '@/lib/desktop'
import { purgeRetiredStorage } from '@/lib/retired-storage'

// The screen gallery's picker, in development only. Folded away in a production export
// exactly as the stage is — see the note in app/(tabs)/index.tsx.
const GallerySwitcher = __DEV__
  ? lazy(async () => {
      const mod = await import('@/dev/gallery')
      return { default: mod.GallerySwitcher }
    })
  : null

export const unstable_settings = {
  anchor: '(tabs)',
}

// The last line of error logging. PostHog's own `capture_exceptions` hears everything
// that escapes to the window, but a render crash caught by a boundary never gets there —
// so the boundary reports it itself, and the player gets a retry instead of a blank page.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { boundary: 'root' })
  }, [error])

  return (
    <CrashScreen
      onRetry={() => {
        void retry()
      }}
    />
  )
}

// Match navigation background to the app's surface tokens so the iOS status
// bar area blends with the screen background instead of showing the default
// white / near-black navigation theme color.
const LightTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#f3efe9' },
}

const AppDarkTheme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#0b0c14' },
}

function ThemedApp() {
  const { colorScheme, transitionOpacity, transitionColor } = useTheme()
  const [splashDone, setSplashDone] = useState(false)

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity.value,
  }))

  return (
    <ThemeProvider value={colorScheme === 'dark' ? AppDarkTheme : LightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: transitionColor,
          },
          overlayStyle,
        ]}
      />
      {!splashDone && (
        <SplashScreen
          onDone={() => {
            setSplashDone(true)
          }}
        />
      )}
    </ThemeProvider>
  )
}

export default function RootLayout() {
  // The picker only has somewhere to live once the app is drawn inside a frame — the
  // same threshold the frame itself uses, so the two can never disagree about it.
  const { width, height } = useWindowDimensions()
  const desktop = isDesktopViewport(width, height)

  // Once per launch, before anything reads storage for real. Nothing waits on it: the
  // keys it clears are ones no build reads, so the app is correct whether it has
  // finished or not.
  useEffect(() => {
    void purgeRetiredStorage()
    // Same once-per-launch moment. A no-op without a key, and on native entirely —
    // see lib/analytics.ts.
    initAnalytics()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        {/* A row, so the gallery's picker takes its own column beside the frame rather
            than floating over it — the frame then centres in what is left. With no
            picker the row has one child at flex-1, which is the layout as it was.
            Desktop only: below that width the window *is* the phone and there is no
            beside. */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {GallerySwitcher !== null && desktop && (
            <Suspense fallback={null}>
              <GallerySwitcher />
            </Suspense>
          )}
          {/* Inside the theme provider, so the frame is drawn in the app's own colours
              and the splash screen is framed along with everything after it. */}
          <View style={{ flex: 1 }}>
            <PhoneFrame>
              <ThemedApp />
            </PhoneFrame>
          </View>
        </View>
      </AppThemeProvider>
    </GestureHandlerRootView>
  )
}

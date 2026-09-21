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
import { InstallOverlay } from '@/components/overlays/install-overlay'
import { PhoneFrame } from '@/components/phone-frame'
import { SplashScreen } from '@/components/splash-screen'
import { InstallProvider, useInstall } from '@/hooks/use-install'
import { LocaleProvider } from '@/hooks/use-locale'
import { SplashProvider, useSplash } from '@/hooks/use-splash'
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
  const { done: splashDone, finish: finishSplash } = useSplash()
  const install = useInstall()

  // Add to home screen is asked on the way in, over the splash — the first launch is
  // exactly the launch worth asking on, and it is also the one where the tutorial
  // opens the moment the splash clears. Asking afterwards meant asking behind it.
  //
  // The splash holds at the end of its intro for as long as there is something to ask,
  // so the popup lands on a still screen; answering it clears the target, which lets
  // the exit play and the game start. The intro screen keeps its own copy of the popup
  // (app/(tabs)/index.tsx) for the launch that has no splash to hold: the reload a
  // service-worker update ends in.
  const [introDone, setIntroDone] = useState(false)
  // Null rather than 'none', so the popup can only be rendered with something to say.
  const askInstall = install.target === 'none' ? null : install.target

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
          hold={askInstall !== null}
          onDone={finishSplash}
          onIntroDone={() => {
            setIntroDone(true)
          }}
        />
      )}
      {/* Over the splash rather than under it — the splash is zIndex 100. */}
      {!splashDone && introDone && askInstall !== null && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 101,
          }}
        >
          <InstallOverlay
            target={askInstall}
            onInstall={install.install}
            onDismiss={install.dismiss}
          />
        </View>
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
      {/* Outside the theme provider: the language decides what every string in the tree
          below says, including the splash and the dev gallery's own chrome, and nothing
          about it depends on the colour scheme. */}
      <LocaleProvider>
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
              and the splash screen is framed along with everything after it. Inside the
              frame for the same reason the splash is: what the provider gates is drawn
              in there with the rest of the app, not over the top of it. */}
            <View style={{ flex: 1 }}>
              <PhoneFrame>
                <SplashProvider>
                  <InstallProvider>
                    <ThemedApp />
                  </InstallProvider>
                </SplashProvider>
              </PhoneFrame>
            </View>
          </View>
        </AppThemeProvider>
      </LocaleProvider>
    </GestureHandlerRootView>
  )
}

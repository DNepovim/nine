import 'react-native-url-polyfill/auto'

import { DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import '@/global.css'

import { CrashScreen } from '@/components/crash-screen'
import { InstallOverlay } from '@/components/overlays/install-overlay'
import { PhoneFrame } from '@/components/phone-frame'
import { SplashScreen } from '@/components/splash-screen'
import { SURFACE } from '@/constants/colors'
import { LAYER } from '@/constants/layers'
import { InstallProvider, useInstall } from '@/hooks/use-install'
import { LocaleProvider } from '@/hooks/use-locale'
import { SavedRunProvider, useSavedRun } from '@/hooks/use-saved-run'
import { SplashProvider, useSplash } from '@/hooks/use-splash'
import { captureError, initAnalytics } from '@/lib/analytics'
import { isDesktopViewport } from '@/lib/desktop'
import { purgeRetiredStorage } from '@/lib/retired-storage'

// The dev column — the screen gallery's picker, the arcade tools one section of its list —
// in development only. Folded away in a production export exactly as the stage is: see the
// note in app/(tabs)/index.tsx.
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

// Match navigation background to the app's surface token so the iOS status
// bar area blends with the screen background instead of showing the default
// white navigation theme color. From SURFACE rather than a hex of its own: a
// copy here would go stale the day the surface moves.
const AppTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: SURFACE },
}

function App() {
  const {
    done: splashDone,
    beginExit: beginSplashExit,
    finish: finishSplash,
  } = useSplash()
  const install = useInstall()
  // Held at frame zero while the launch asks storage whether it owes the player a run in
  // progress — see SplashScreen's `ready`.
  const { probing: probingSavedRun } = useSavedRun()

  // Add to home screen is asked on the way in, over the splash — the first launch is
  // exactly the launch worth asking on, and it is also the one where the welcome run
  // starts the moment the splash clears. Asking afterwards meant asking behind it.
  //
  // The splash holds at the end of its intro for as long as there is something to ask,
  // so the popup lands on a still screen; answering it clears the target, which lets
  // the exit play and the game start. The intro screen keeps its own copy of the popup
  // (app/(tabs)/index.tsx) for the launch that has no splash to hold: the reload a
  // service-worker update ends in.
  const [introDone, setIntroDone] = useState(false)
  // Null rather than 'none', so the popup can only be rendered with something to say.
  const askInstall = install.target === 'none' ? null : install.target

  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
      {!splashDone && (
        <SplashScreen
          hold={askInstall !== null}
          ready={!probingSavedRun}
          onDone={finishSplash}
          onExit={beginSplashExit}
          onIntroDone={() => {
            setIntroDone(true)
          }}
        />
      )}
      {/* Over the splash rather than under it — see LAYER. */}
      {!splashDone && introDone && askInstall !== null && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: LAYER.splashPrompt,
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
      {/* The language decides what every string in the tree below says, including the
          splash and the dev gallery's own chrome. */}
      <LocaleProvider>
        {/* A row, so the dev column sits beside the frame rather than floating over it —
          the frame then centres in what is left. One column and not two: every dev tool
          there is lives in the picker now. With no picker the row has one child at
          flex-1, which is the layout as it was. Desktop only: below that width the
          window *is* the phone and there is no beside. */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {GallerySwitcher !== null && desktop && (
            <Suspense fallback={null}>
              <GallerySwitcher />
            </Suspense>
          )}
          <View style={{ flex: 1 }}>
            <PhoneFrame>
              {/* Outside the splash provider, which reads it: a launch opening onto
                  a run the app was closed on has no logo to play. */}
              <SavedRunProvider>
                <SplashProvider>
                  <InstallProvider>
                    <App />
                  </InstallProvider>
                </SplashProvider>
              </SavedRunProvider>
            </PhoneFrame>
          </View>
        </View>
      </LocaleProvider>
    </GestureHandlerRootView>
  )
}

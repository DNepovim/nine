import 'react-native-url-polyfill/auto'

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import '@/global.css'

import { SplashScreen } from '@/components/splash-screen'
import { SplashProvider, useSplash } from '@/hooks/use-splash'
import { AppThemeProvider, useTheme } from '@/hooks/use-theme'

export const unstable_settings = {
  anchor: '(tabs)',
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
      {!splashDone && <SplashScreen onDone={finishSplash} />}
    </ThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <SplashProvider>
          <ThemedApp />
        </SplashProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  )
}

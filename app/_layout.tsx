import 'react-native-url-polyfill/auto'

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import '@/global.css'

import { SplashScreen } from '@/components/splash-screen'
import { AppThemeProvider, useTheme } from '@/hooks/use-theme'

export const unstable_settings = {
  anchor: '(tabs)',
}

function ThemedApp() {
  const { colorScheme, transitionOpacity, transitionColor } = useTheme()
  const [splashDone, setSplashDone] = useState(false)

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity.value,
  }))

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <ThemedApp />
      </AppThemeProvider>
    </GestureHandlerRootView>
  )
}

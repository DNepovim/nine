import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'

import { SURFACE_WASH } from '@/constants/colors'

// The app's background: the splash gradient, washed out. Drawn first inside whatever it
// fills, so everything after it paints on top.
export function SurfaceWash() {
  return (
    <LinearGradient
      colors={[...SURFACE_WASH]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  )
}

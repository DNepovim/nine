import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'

import { useScheme } from '@/hooks/use-scheme'

// The app's background: the splash gradient, washed out. Drawn first inside whatever it
// fills, so everything after it paints on top.
//
// Its stops are the **scheme**'s, which is `day` everywhere but a game screen played
// under another — see `useScheme`.
export function SurfaceWash() {
  const { wash } = useScheme().inks
  return (
    <LinearGradient
      colors={[...wash]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  )
}

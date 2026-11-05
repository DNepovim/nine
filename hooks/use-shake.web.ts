import { useSharedValue, type SharedValue } from 'react-native-reanimated'

// A browser has no accelerometer to read here, so nothing is ever shaken.
//
// The native file is `use-shake.ts`.
//
// @public
export function useShake(): SharedValue<number> {
  return useSharedValue(0)
}

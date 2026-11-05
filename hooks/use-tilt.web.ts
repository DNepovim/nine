import { useSharedValue, type SharedValue } from 'react-native-reanimated'

// A browser has no gravity sensor to read here, so a surface drawn from the tilt stays level.
//
// The native file is `use-tilt.ts`.
//
// @public
export function useTilt(): SharedValue<number> {
  return useSharedValue(0)
}

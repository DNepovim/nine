import { useWindowDimensions } from 'react-native'

// The game screen's dial pad is a square of min(width, height) inside a flex-1
// area that splits the leftover height with the targets area. Deriving the same
// number here — rather than measuring whatever space a lesson happens to leave —
// puts the tutorial's dial at exactly the size and position the player will meet
// in a real game, however much copy sits above it.
//
// These mirror app/(tabs)/index.tsx's layout; they only need to be roughly right.
const SCREEN_PADDING_X = 32 // Screen px-4, both sides
const SCREEN_PADDING_Y = 16 // Screen py-2, top + bottom
const HUD_HEIGHT = 70 // mode / NINE / hearts / score block, incl. mb-3

// The sum readout's slot above the dial. Lessons reserve it even when they have
// no total to show, so the dial never drifts up.
export const SUM_ROW_HEIGHT = 50

export function useGameDialSize(): number {
  const { width, height } = useWindowDimensions()
  const dialArea = (height - SCREEN_PADDING_Y - HUD_HEIGHT - SUM_ROW_HEIGHT) / 2
  return Math.max(0, Math.floor(Math.min(width - SCREEN_PADDING_X, dialArea)))
}

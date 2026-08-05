import { useWindowDimensions } from 'react-native'

// The game screen's dial pad is a square of min(width, height) inside a flex-1
// area that splits the leftover height with the targets area. A tutorial lesson
// has more copy above its dial but less below, so measuring alone would hand it a
// *larger* square than the real thing on shorter screens — and DialButton's
// numeral is a fixed 30px, so an oversized button looks wrong. Capping at the
// game's own budget keeps tutorial buttons the size the player will meet.
//
// These mirror app/(tabs)/index.tsx's layout; they only need to be roughly right.
const SCREEN_PADDING = 16 // Screen py-2, top + bottom
const HUD_HEIGHT = 70 // mode / NINE / hearts / score block, incl. mb-3
const SUM_ROW_HEIGHT = 50 // the sum readout above the dial

export function useGameDialSize(measured: number): number {
  const { height } = useWindowDimensions()
  const gameDialArea = (height - SCREEN_PADDING - HUD_HEIGHT - SUM_ROW_HEIGHT) / 2
  return Math.min(measured, Math.floor(gameDialArea))
}

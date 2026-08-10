import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { ConfettiPiece } from '@/components/game/confetti-piece'
import { SPECTRUM } from '@/constants/colors'

// Beating your own best is the loudest moment the game has, so this is a proper
// shower rather than a sprinkle. Every piece is a Reanimated view driven on the UI
// thread; if it ever costs frames on a low-end device, this constant is the dial.
const PIECE_COUNT = 80

// Timings are kept inside the announcement's own three seconds — the parent unmounts
// this when the message clears, so anything still falling would be cut mid-air.
const MAX_DELAY_MS = 500
const MIN_FALL_MS = 1400
const EXTRA_FALL_MS = 800

// A one-shot confetti fall in the game's spectrum colours. Mounting plays it; the
// parent unmounts it when the moment is over. Rendered behind the game UI and
// non-interactive, so pieces fall through the gaps between dial keys and targets
// without ever swallowing a tap.
export function Confetti() {
  const { width, height } = useWindowDimensions()

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        color: SPECTRUM[i % SPECTRUM.length] ?? SPECTRUM[0],
        startX: Math.random() * width,
        size: 4 + Math.random() * 7,
        delay: Math.random() * MAX_DELAY_MS,
        duration: MIN_FALL_MS + Math.random() * EXTRA_FALL_MS,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 900,
      })),
    [width],
  )

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {pieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          color={piece.color}
          startX={piece.startX}
          size={piece.size}
          delay={piece.delay}
          duration={piece.duration}
          fallTo={height}
          drift={piece.drift}
          spin={piece.spin}
        />
      ))}
    </View>
  )
}

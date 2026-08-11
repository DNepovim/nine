import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { ConfettiPiece } from '@/components/game/confetti-piece'
import { SPECTRUM } from '@/constants/colors'

// Beating your own best is the loudest moment the game has, so that is a proper
// shower rather than a sprinkle. Trainee celebrates a single clean hit, which
// happens many times a run and should not shout as loudly — half the pieces.
//
// Every piece is a Reanimated view driven on the UI thread; if it ever costs
// frames on a low-end device, these are the dial.
const PIECE_COUNT = { full: 80, half: 40 } as const

type Density = keyof typeof PIECE_COUNT

// Starts are spread across most of the announcement rather than bunched at the top, so
// confetti keeps arriving while earlier pieces are still falling — one shower instead of
// one batch. The last piece to start still lands before the parent unmounts this at the
// five-second mark, so nothing gets cut mid-air.
const MAX_DELAY_MS = 2000
const MIN_FALL_MS = 1900
const EXTRA_FALL_MS = 600

// A one-shot confetti fall in the game's spectrum colours. Mounting plays it; the
// parent unmounts it when the moment is over. Rendered behind the game UI and
// non-interactive, so pieces fall through the gaps between dial keys and targets
// without ever swallowing a tap.
export function Confetti({
  colors = SPECTRUM,
  density = 'full',
}: {
  // Non-empty, so colors[0] is a guaranteed fallback for the computed index.
  colors?: readonly [string, ...string[]]
  density?: Density
}) {
  const { width, height } = useWindowDimensions()

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT[density] }, (_, i) => ({
        id: i,
        color: colors[i % colors.length] ?? SPECTRUM[0],
        startX: Math.random() * width,
        size: 4 + Math.random() * 7,
        delay: Math.random() * MAX_DELAY_MS,
        duration: MIN_FALL_MS + Math.random() * EXTRA_FALL_MS,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 900,
      })),
    [width, colors, density],
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

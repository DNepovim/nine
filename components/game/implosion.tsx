import { useMemo } from 'react'
import { View } from 'react-native'

import { ImplosionStreak } from '@/components/game/implosion-streak'
import { useViewport } from '@/hooks/use-viewport'

const STREAK_COUNT = 90
const STREAK_LENGTH = 50
const APPEAR_SPREAD_MS = 900

// Kept fainter than the celebrations: this is the light going out, not a prize.
const MIN_OPACITY = 0.3
const MAX_OPACITY = 0.7

// Losing a record you held: the jump to lightspeed played in reverse. Lines appear out
// near the edges, are pulled inwards along their own ray, and collapse into the centre.
// The direction is the whole message — everything converges instead of escaping.
export function Implosion({ colors }: { colors: readonly [string, ...string[]] }) {
  const { width, height } = useViewport()

  const centerX = width / 2
  const centerY = height / 2
  const edgeRadius = Math.hypot(width, height) / 2

  const streaks = useMemo(
    () =>
      Array.from({ length: STREAK_COUNT }, (_, i) => ({
        id: i,
        angle: Math.random() * 360,
        // Start spread through the outer half of the screen, finish at the centre.
        fromRadius: edgeRadius * (0.45 + Math.random() * 0.55),
        toRadius: 0,
        thickness: 1.5 + Math.random() * 1.5,
        color: colors[i % colors.length] ?? colors[0],
        delay: Math.random() * APPEAR_SPREAD_MS,
        peakOpacity: MIN_OPACITY + Math.random() * (MAX_OPACITY - MIN_OPACITY),
      })),
    [edgeRadius, colors],
  )

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {/* Zero-size anchor at the centre: every streak rotates about this exact point,
          so the rays all converge on one origin. */}
      <View style={{ position: 'absolute', left: centerX, top: centerY }}>
        {streaks.map((streak) => (
          <ImplosionStreak
            key={streak.id}
            angle={streak.angle}
            fromRadius={streak.fromRadius}
            toRadius={streak.toRadius}
            length={STREAK_LENGTH}
            thickness={streak.thickness}
            color={streak.color}
            delay={streak.delay}
            peakOpacity={streak.peakOpacity}
          />
        ))}
      </View>
    </View>
  )
}

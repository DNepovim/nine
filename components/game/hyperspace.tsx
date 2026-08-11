import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { HyperspaceStreak } from '@/components/game/hyperspace-streak'

const STAR_COUNT = 120
const STREAK_LENGTH = 60

// Stars keep lighting up for well over a second, so the field is still filling while
// the first streaks are already flying out — a continuous jump rather than one volley.
const APPEAR_SPREAD_MS = 1400

// Translucent, and varied, so a dense field reads as depth instead of covering the
// board — and so the game stays visible through the jump.
const MIN_OPACITY = 0.4
const MAX_OPACITY = 0.85

// The jump to lightspeed, for an all-time record. Stars scatter across the screen,
// stretch into lines pointing away from the centre, then streak off the edges. Every
// streak lies on its own ray out of the centre, which is what sells the direction.
//
// The palette comes from the announcement rather than being fixed here, and every
// colour it is given is mid-tone, so this needs no theme variant: they read on both
// the light and dark surfaces where white would vanish on one.
export function Hyperspace({ colors }: { colors: readonly [string, ...string[]] }) {
  const { width, height } = useWindowDimensions()

  const centerX = width / 2
  const centerY = height / 2
  // Far enough that a stretched streak has fully left the screen at the corner.
  const exitRadius = Math.hypot(width, height) / 2 + STREAK_LENGTH * 2

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        angle: Math.random() * 360,
        // Spread the dots over most of the screen rather than clustering at the
        // centre, so the starfield looks like a sky before it starts moving.
        fromRadius: exitRadius * (0.05 + Math.random() * 0.7),
        thickness: 1.5 + Math.random() * 1.5,
        // Stepping through the palette rather than picking at random keeps every
        // colour evenly represented however many stars there are.
        color: colors[i % colors.length] ?? colors[0],
        delay: Math.random() * APPEAR_SPREAD_MS,
        peakOpacity: MIN_OPACITY + Math.random() * (MAX_OPACITY - MIN_OPACITY),
      })),
    [exitRadius, colors],
  )

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {/* Zero-size anchor at the centre: every streak rotates about this exact point,
          so the rays all share one origin. */}
      <View style={{ position: 'absolute', left: centerX, top: centerY }}>
        {stars.map((star) => (
          <HyperspaceStreak
            key={star.id}
            angle={star.angle}
            fromRadius={star.fromRadius}
            toRadius={exitRadius}
            length={STREAK_LENGTH}
            thickness={star.thickness}
            color={star.color}
            delay={star.delay}
            peakOpacity={star.peakOpacity}
          />
        ))}
      </View>
    </View>
  )
}

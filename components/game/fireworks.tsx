import { useMemo } from 'react'
import { View } from 'react-native'

import { FireworkParticle } from '@/components/game/firework-particle'
import { useViewport } from '@/hooks/use-viewport'

const BURSTS = 9
const SPARKS_PER_BURST = 18

// Bursts keep going off for close to three seconds, each one overlapping the last, so
// the volley builds instead of firing all at once. The final burst still finishes before
// the parent unmounts this at the five-second mark.
const BURST_STAGGER_MS = 340
const FLIGHT_MS = 1200

// A short volley of bursts for beating the weekly record. Each burst throws its sparks
// out along evenly spaced angles — jittered, so the ring reads as an explosion rather
// than a cog — and they arc down as they fade. Mounting plays it once; the parent
// unmounts it when the announcement clears.
export function Fireworks({ colors }: { colors: readonly [string, ...string[]] }) {
  const { width, height } = useViewport()

  const sparks = useMemo(() => {
    const all: {
      key: string
      originX: number
      originY: number
      dx: number
      dy: number
      size: number
      color: string
      delay: number
    }[] = []

    for (let b = 0; b < BURSTS; b++) {
      // Keep bursts in the upper two thirds, clear of the dial.
      const originX = width * (0.15 + Math.random() * 0.7)
      const originY = height * (0.12 + Math.random() * 0.45)
      const reach = 60 + Math.random() * 70
      const color = colors[b % colors.length] ?? colors[0]
      const burstDelay = b * BURST_STAGGER_MS

      for (let s = 0; s < SPARKS_PER_BURST; s++) {
        const spread = (Math.PI * 2) / SPARKS_PER_BURST
        const angle = s * spread + (Math.random() - 0.5) * spread
        const distance = reach * (0.65 + Math.random() * 0.35)
        all.push({
          key: `${b}-${s}`,
          originX,
          originY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          size: 3 + Math.random() * 3,
          color,
          delay: burstDelay + Math.random() * 60,
        })
      }
    }
    return all
  }, [width, height, colors])

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      {sparks.map((spark) => (
        <FireworkParticle
          key={spark.key}
          originX={spark.originX}
          originY={spark.originY}
          dx={spark.dx}
          dy={spark.dy}
          size={spark.size}
          color={spark.color}
          delay={spark.delay}
          duration={FLIGHT_MS}
        />
      ))}
    </View>
  )
}

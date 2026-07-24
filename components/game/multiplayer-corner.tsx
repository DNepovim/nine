import { useFonts } from 'expo-font'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { FloatingPoints } from '@/components/game/floating-points'
import { mono } from '@/constants/theme'
import { cn } from '@/lib/cn'
import type { PlayerState } from '@/types/multiplayer'

type Float = { id: number; points: number }

export function MultiplayerCorner({
  player,
  isMe,
  gradient,
}: {
  player: PlayerState | undefined
  isMe: boolean
  gradient: [string, string]
}) {
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const [floats, setFloats] = useState<Float[]>([])
  const floatId = useRef(0)
  const prevScore = useRef<number | null>(null)

  const removeFloat = (id: number) => {
    setFloats((prev) => prev.filter((x) => x.id !== id))
  }

  useEffect(() => {
    if (!player) {
      prevScore.current = null
      return
    }
    if (prevScore.current !== null && player.score > prevScore.current) {
      const delta = player.score - prevScore.current
      setFloats((f) => [...f, { id: ++floatId.current, points: delta }])
    }
    prevScore.current = player.score
  }, [player?.score, player])

  if (!player) return null

  const nick = player.nickname.length > 8 ? player.nickname.slice(0, 8) : player.nickname

  return (
    <View className="relative min-w-[72px]">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-[10px] px-2 py-1.5 items-center gap-0.5"
      >
        <Text
          selectable={false}
          numberOfLines={1}
          className={cn(
            'font-mono text-[11px] font-bold tracking-[1px] text-white',
            !isMe && 'opacity-75',
          )}
        >
          {nick}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text
            selectable={false}
            style={{
              fontFamily: dsegLoaded ? 'DSEG7' : mono,
              fontSize: 22,
              color: '#ffffff',
              includeFontPadding: false,
            }}
          >
            {player.score}
          </Text>
          {player.hitCurrentTarget && (
            <Text selectable={false} className="text-[12px]" style={{ color: '#4ADE80' }}>
              ✓
            </Text>
          )}
        </View>
      </LinearGradient>
      {floats.map((f) => (
        <FloatingPoints
          key={f.id}
          points={f.points}
          progress={1}
          bonus={false}
          onDone={() => {
            removeFloat(f.id)
          }}
        />
      ))}
    </View>
  )
}

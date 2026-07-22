import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import { useLeaderboard } from '@/hooks/use-leaderboard'
import type { LeaderboardState } from '@/hooks/use-leaderboard'
import { type LeaderboardTab } from '@/lib/leaderboard'
import { MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

const TABS: { key: LeaderboardTab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'forever', label: 'FOREVER' },
]

type ScoreEntry = {
  rank: number
  nickname: string
  score: number
  isUser?: boolean
}

function ScoreRow({ entry, accentColor }: { entry: ScoreEntry; accentColor: string }) {
  const highlight = entry.isUser === true
  const accentStyle = highlight ? { color: accentColor } : undefined
  return (
    <View
      className="flex-row items-center rounded-lg px-2 py-1.5"
      style={highlight ? { backgroundColor: accentColor + '20' } : undefined}
    >
      <Text
        selectable={false}
        className="w-7 font-mono text-[10px] font-bold text-dim"
        style={accentStyle}
      >
        {entry.rank}
      </Text>
      <Text
        selectable={false}
        className="flex-1 font-mono text-[10px] font-bold tracking-[0.5px] text-primary"
        style={accentStyle}
      >
        {entry.nickname}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-bold text-primary"
        style={accentStyle}
      >
        {entry.score}
      </Text>
    </View>
  )
}

function SkeletonRow() {
  return (
    <View className="flex-row items-center px-2 py-1.5">
      <View className="mr-1 h-2.5 w-5 rounded-sm bg-dim/20" />
      <View className="mr-1 h-2.5 flex-1 rounded-sm bg-dim/20" />
      <View className="h-2.5 w-10 rounded-sm bg-dim/20" />
    </View>
  )
}

function TabPanel({
  data,
  accentColor,
  nickname,
  width,
}: {
  data: LeaderboardState
  accentColor: string
  nickname: string | null
  width: number
}) {
  if (data.loading) {
    return (
      <View style={{ width }} className="items-center py-4">
        <ActivityIndicator size="small" color={accentColor} />
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    )
  }

  if (data.error) {
    return (
      <View style={{ width }} className="items-center py-6">
        <Text selectable={false} className="font-mono text-[9px] font-bold text-dim">
          COULD NOT LOAD
        </Text>
      </View>
    )
  }

  const top5 = data.rows
  const myRank = data.myRank
  const userIsInTop5 = myRank !== null && myRank.rank <= top5.length

  return (
    <View style={{ width }}>
      {top5.map((row) => (
        <ScoreRow
          key={row.user_id}
          entry={{ rank: row.rank, nickname: row.nickname, score: row.best_score }}
          accentColor={accentColor}
        />
      ))}
      {myRank !== null && !userIsInTop5 && nickname !== null && (
        <>
          <View className="items-center py-1">
            <Text
              selectable={false}
              className="font-mono text-[11px] tracking-[6px] text-dim"
            >
              ⋯
            </Text>
          </View>
          <ScoreRow
            entry={{
              rank: myRank.rank,
              nickname,
              score: myRank.best_score,
              isUser: true,
            }}
            accentColor={accentColor}
          />
        </>
      )}
    </View>
  )
}

export function HighScores({
  gameMode,
  difficulty,
  userId,
  nickname,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
}) {
  const { width: windowWidth } = useWindowDimensions()
  const [panelWidth, setPanelWidth] = useState(0)
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('today')
  const scrollRef = useRef<ScrollView>(null)
  const autoplayRef = useRef(true)
  const activeIndexRef = useRef(0)
  const tabLayouts = useRef<{ x: number; width: number }[]>([])
  const underlineLeft = useSharedValue(-999)
  const underlineRight = useSharedValue(-999)

  const accentColor = MODE_GRADIENT[gameMode][0]
  const gradientColors = MODE_GRADIENT[gameMode] as [string, string]
  const effectiveWidth = panelWidth > 0 ? panelWidth : windowWidth - 32

  const { today, week, forever } = useLeaderboard(gameMode, difficulty, userId)
  const dataByTab: Record<LeaderboardTab, LeaderboardState> = { today, week, forever }

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineLeft.value }],
    width: Math.max(0, underlineRight.value - underlineLeft.value),
  }))

  // Stretch-then-shrink: leading edge jumps first, trailing edge follows after a delay.
  useEffect(() => {
    const index = TABS.findIndex((t) => t.key === activeTab)
    const layout = tabLayouts.current[index]
    if (!layout) return
    const newLeft = layout.x
    const newRight = layout.x + layout.width
    const spring = { damping: 40, stiffness: 300 }
    if (underlineLeft.value < -900) {
      underlineLeft.value = newLeft
      underlineRight.value = newRight
      return
    }
    if (newLeft >= underlineLeft.value) {
      // Moving right: right edge leads, left edge follows
      underlineRight.value = withSpring(newRight, spring)
      underlineLeft.value = withDelay(120, withSpring(newLeft, spring))
    } else {
      // Moving left: left edge leads, right edge follows
      underlineLeft.value = withSpring(newLeft, spring)
      underlineRight.value = withDelay(120, withSpring(newRight, spring))
    }
  }, [activeTab, underlineLeft, underlineRight])

  // Auto-advance tabs every 2 s until the user taps or swipes.
  useEffect(() => {
    const id = setInterval(() => {
      if (!autoplayRef.current) return
      const nextIndex = (activeIndexRef.current + 1) % TABS.length
      const next = TABS[nextIndex]
      if (!next) return
      activeIndexRef.current = nextIndex
      setActiveTab(next.key)
      scrollRef.current?.scrollTo({ x: nextIndex * effectiveWidth, animated: true })
    }, 2000)
    return () => {
      clearInterval(id)
    }
  }, [effectiveWidth])

  const goToTab = (key: LeaderboardTab) => {
    autoplayRef.current = false
    const index = TABS.findIndex((t) => t.key === key)
    activeIndexRef.current = index
    setActiveTab(key)
    scrollRef.current?.scrollTo({ x: index * effectiveWidth, animated: true })
  }

  return (
    <View className="mb-8 w-full max-w-3xs self-center">
      {/* Time-period tabs */}
      <View className="mb-3">
        <View className="flex-row justify-center">
          {TABS.map(({ key, label }, i) => (
            <Pressable
              key={key}
              onPress={() => {
                goToTab(key)
              }}
              onLayout={(e) => {
                tabLayouts.current[i] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                }
                if (key === activeTab) {
                  underlineLeft.value = e.nativeEvent.layout.x
                  underlineRight.value =
                    e.nativeEvent.layout.x + e.nativeEvent.layout.width
                }
              }}
              className="px-3 py-1.5"
            >
              <Text
                selectable={false}
                className="font-mono text-[9px] font-bold tracking-[1px] text-primary"
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Animated gradient underline */}
        <Animated.View
          style={[
            underlineStyle,
            {
              position: 'absolute',
              bottom: 0,
              height: 4,
              borderRadius: 2,
              overflow: 'hidden',
            },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* Column headers */}
      <View className="mb-1 flex-row px-2">
        <Text
          selectable={false}
          className="w-7 font-mono text-[8px] font-bold tracking-[1px] text-dim"
        >
          #
        </Text>
        <Text
          selectable={false}
          className="flex-1 font-mono text-[8px] font-bold tracking-[1px] text-dim"
        >
          NICK
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
        >
          SCORE
        </Text>
      </View>

      {/* Paging scroll view — swipe or tap tabs to navigate */}
      <View
        className="w-full"
        onLayout={(e) => {
          setPanelWidth(e.nativeEvent.layout.width)
        }}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScrollBeginDrag={() => {
            autoplayRef.current = false
          }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / effectiveWidth)
            const tab = TABS[index]
            if (tab) setActiveTab(tab.key)
          }}
        >
          {TABS.map(({ key }) => (
            <TabPanel
              key={key}
              data={dataByTab[key]}
              accentColor={accentColor}
              nickname={nickname}
              width={effectiveWidth}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

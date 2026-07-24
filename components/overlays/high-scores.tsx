import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import { useLeaderboard } from '@/hooks/use-leaderboard'
import type { LeaderboardState } from '@/hooks/use-leaderboard'
import {
  type LeaderboardRow,
  type LeaderboardTab,
  type MyRankRow,
} from '@/lib/leaderboard'
import { MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

import { TabPanel } from './tab-panel'

const TABS: { key: LeaderboardTab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'forever', label: 'FOREVER' },
]

function applyOptimistic(
  state: LeaderboardState,
  userId: string | null,
  nickname: string | null,
  optimisticScore: number | undefined,
  optimisticHits: number | undefined,
): LeaderboardState {
  if (!optimisticScore || !userId || !nickname || state.loading || state.error !== null) {
    return state
  }
  // Real data already includes this user — no injection needed.
  if (state.rows.some((r) => r.user_id === userId)) return state

  // Use the better of the current-game score and any stored best so we never
  // show a rank worse than what the server would report.
  const effectiveScore = Math.max(optimisticScore, state.myRank?.best_score ?? 0)
  const effectiveHits =
    effectiveScore === optimisticScore ? (optimisticHits ?? 0) : (state.myRank?.hits ?? 0)

  const rows = state.rows
  const beatCount = rows.filter(
    (r) => r.user_id !== userId && r.best_score >= effectiveScore,
  ).length
  const newRank = beatCount + 1

  const newMyRank: MyRankRow = {
    rank: newRank,
    total: Math.max(state.myRank?.total ?? 0, newRank),
    best_score: effectiveScore,
    hits: effectiveHits,
  }

  let newRows = rows
  if (newRank <= 5) {
    const others = rows.filter((r) => r.user_id !== userId)
    const above = others.filter((r) => r.best_score >= effectiveScore)
    const below = others.filter((r) => r.best_score < effectiveScore)
    const entry: LeaderboardRow = {
      rank: above.length + 1,
      user_id: userId,
      nickname,
      best_score: effectiveScore,
      hits: effectiveHits,
    }
    newRows = [
      ...above.map((r, i) => ({ ...r, rank: i + 1 })),
      entry,
      ...below.map((r, i) => ({ ...r, rank: above.length + 2 + i })),
    ].slice(0, 5)
  }

  return { rows: newRows, myRank: newMyRank, loading: false, error: null }
}

export function HighScores({
  gameMode,
  difficulty,
  userId,
  nickname,
  optimisticScore,
  optimisticHits,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  optimisticScore?: number
  optimisticHits?: number
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
  const dataByTab: Record<LeaderboardTab, LeaderboardState> = {
    today: applyOptimistic(today, userId, nickname, optimisticScore, optimisticHits),
    week: applyOptimistic(week, userId, nickname, optimisticScore, optimisticHits),
    forever: applyOptimistic(forever, userId, nickname, optimisticScore, optimisticHits),
  }

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
          className="absolute bottom-0 h-1 rounded-sm overflow-hidden"
          style={underlineStyle}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="flex-1"
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
              userId={userId}
              nickname={nickname}
              width={effectiveWidth}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

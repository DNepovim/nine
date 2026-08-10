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
import { usePendingScores } from '@/hooks/use-pending-scores'
import { type LeaderboardTab } from '@/lib/leaderboard'
import { withMyBest } from '@/lib/leaderboard-optimistic'
import { todayISO } from '@/lib/leaderboard-period'
import { bestPendingScore } from '@/lib/pending-scores'
import { MODE_GRADIENT, type Difficulty, type Mode } from '@/machines/game'

import { PublishScoresButton } from './publish-scores-button'
import { TabPanel } from './tab-panel'

const TABS: { key: LeaderboardTab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'forever', label: 'EVER' },
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
  const merged = withMyBest(
    state.rows,
    state.myRank,
    userId,
    nickname,
    optimisticScore,
    optimisticHits ?? 0,
  )
  return { ...merged, loading: false, error: null }
}

export function HighScores({
  gameMode,
  difficulty,
  userId,
  nickname,
  optimisticScore,
  optimisticHits,
  onAddNickname,
}: {
  gameMode: Mode
  difficulty: Difficulty
  userId: string | null
  nickname: string | null
  optimisticScore?: number
  optimisticHits?: number
  // Opens the nickname prompt so the player's local bests can be published.
  onAddNickname: () => void
}) {
  const { width: windowWidth } = useWindowDimensions()
  const [panelWidth, setPanelWidth] = useState(0)
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('today')
  const scrollRef = useRef<ScrollView>(null)
  const autoplayRef = useRef(true)
  const activeIndexRef = useRef(0)
  const tabLayouts = useRef<{ x: number; width: number }[]>([])
  const isAutoScrolling = useRef(false)
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
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

  // Local runs that never reached the server, shown with a mark until a nickname
  // exists — at which point the flush publishes them and the real rows take over.
  const pending = usePendingScores(nickname === null)
  const day = todayISO()
  const unpublishedByTab: Record<LeaderboardTab, number | null> = {
    today: bestPendingScore(pending, gameMode, difficulty, 'today', day),
    week: bestPendingScore(pending, gameMode, difficulty, 'week', day),
    forever: bestPendingScore(pending, gameMode, difficulty, 'forever', day),
  }
  const hasUnpublished = unpublishedByTab.forever !== null

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
      isAutoScrolling.current = true
      activeIndexRef.current = nextIndex
      setActiveTab(next.key)
      scrollRef.current?.scrollTo({ x: nextIndex * effectiveWidth, animated: true })
      setTimeout(() => {
        isAutoScrolling.current = false
      }, 600)
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
          scrollEventThrottle={16}
          onScroll={(e) => {
            if (isAutoScrolling.current) return
            autoplayRef.current = false
            const x = e.nativeEvent.contentOffset.x
            clearTimeout(scrollEndTimer.current)
            scrollEndTimer.current = setTimeout(() => {
              const index = Math.round(x / effectiveWidth)
              const tab = TABS[index]
              if (tab) {
                activeIndexRef.current = index
                setActiveTab(tab.key)
              }
            }, 80)
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
              unpublishedScore={unpublishedByTab[key]}
            />
          ))}
        </ScrollView>
      </View>

      {hasUnpublished && (
        <PublishScoresButton
          from={gradientColors[0]}
          to={gradientColors[1]}
          onPress={onAddNickname}
        />
      )}
    </View>
  )
}

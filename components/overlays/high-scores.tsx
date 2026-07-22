import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

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
  const textStyle = highlight ? { color: '#FFFFFF' as const } : undefined
  return (
    <View
      className="flex-row items-center rounded-lg px-2 py-1.5"
      style={highlight ? { backgroundColor: accentColor } : undefined}
    >
      <Text
        selectable={false}
        className="w-7 font-mono text-[10px] font-bold text-dim"
        style={textStyle}
      >
        {entry.rank}
      </Text>
      <Text
        selectable={false}
        className="flex-1 font-mono text-[10px] font-bold tracking-[0.5px] text-primary"
        style={textStyle}
      >
        {entry.nickname}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-bold text-primary"
        style={textStyle}
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

  const accentColor = MODE_GRADIENT[gameMode][0]
  const effectiveWidth = panelWidth > 0 ? panelWidth : windowWidth - 32

  const { today, week, forever } = useLeaderboard(gameMode, difficulty, userId)
  const dataByTab: Record<LeaderboardTab, LeaderboardState> = { today, week, forever }

  const goToTab = (key: LeaderboardTab) => {
    const index = TABS.findIndex((t) => t.key === key)
    setActiveTab(key)
    scrollRef.current?.scrollTo({ x: index * effectiveWidth, animated: true })
  }

  return (
    <View className="mb-8 w-full max-w-3xs self-center">
      {/* Time-period tabs */}
      <View className="mb-3 flex-row justify-center gap-1">
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => {
              goToTab(key)
            }}
            className="rounded-lg px-3 py-1.5"
            style={activeTab === key ? { backgroundColor: accentColor } : undefined}
          >
            <Text
              selectable={false}
              className="font-mono text-[9px] font-bold tracking-[1px]"
              style={{ color: activeTab === key ? '#FFFFFF' : accentColor }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
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

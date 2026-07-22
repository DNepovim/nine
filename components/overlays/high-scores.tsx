import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'

import {
  DIFFICULTY_ORDER,
  MODE_GRADIENT,
  MODE_ORDER,
  type Mode,
  type Stats,
} from '@/machines/game'

type Tab = 'today' | 'week' | 'forever'

type ScoreEntry = {
  rank: number
  nickname: string
  score: number
  isUser?: boolean
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'forever', label: 'FOREVER' },
]

// Placeholder leaderboard data — replace with live API responses per tab
const MOCK_TOP5: Record<Tab, ScoreEntry[]> = {
  today: [
    { rank: 1, nickname: 'DOMINO', score: 184 },
    { rank: 2, nickname: 'SPEEDY', score: 162 },
    { rank: 3, nickname: 'ACE_9', score: 143 },
    { rank: 4, nickname: 'BLAZE', score: 128 },
    { rank: 5, nickname: 'NOVA', score: 105 },
  ],
  week: [
    { rank: 1, nickname: 'ACE_9', score: 982 },
    { rank: 2, nickname: 'DOMINO', score: 874 },
    { rank: 3, nickname: 'SPEEDY', score: 761 },
    { rank: 4, nickname: 'BLAZE', score: 639 },
    { rank: 5, nickname: 'KIRO', score: 508 },
  ],
  forever: [
    { rank: 1, nickname: 'ACE_9', score: 4820 },
    { rank: 2, nickname: 'DOMINO', score: 4180 },
    { rank: 3, nickname: 'SPEEDY', score: 3560 },
    { rank: 4, nickname: 'BLAZE', score: 2890 },
    { rank: 5, nickname: 'KIRO', score: 2210 },
  ],
}

// Placeholder user ranks per tab — will come from the API
const MOCK_USER_RANK: Record<Tab, number> = {
  today: 7,
  week: 12,
  forever: 42,
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

export function HighScores({ gameMode, stats }: { gameMode: Mode; stats: Stats }) {
  const { width: windowWidth } = useWindowDimensions()
  const [panelWidth, setPanelWidth] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const scrollRef = useRef<ScrollView>(null)

  const accentColor = MODE_GRADIENT[gameMode][0]
  // Fall back to window width minus Screen's px-4 padding until onLayout fires
  const effectiveWidth = panelWidth > 0 ? panelWidth : windowWidth - 32

  // User's all-time best across every mode × difficulty
  const userScore = Math.max(
    0,
    ...DIFFICULTY_ORDER.flatMap((d) => MODE_ORDER.map((m) => stats[m][d].score)),
  )

  const goToTab = (key: Tab) => {
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

      {/* Column headers — fixed above the sliding panels */}
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

      {/* Paging scroll view — each page is one tab's data; swipe or tap tabs to navigate */}
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
          {TABS.map(({ key }) => {
            const top5 = MOCK_TOP5[key]
            const userInTop5 = top5.some((e) => e.isUser)
            const userEntry: ScoreEntry = {
              rank: MOCK_USER_RANK[key],
              nickname: 'YOU',
              score: userScore,
              isUser: true,
            }
            return (
              <View key={key} style={{ width: effectiveWidth }}>
                {top5.map((entry) => (
                  <ScoreRow key={entry.rank} entry={entry} accentColor={accentColor} />
                ))}
                {!userInTop5 && (
                  <>
                    <View className="items-center py-1">
                      <Text
                        selectable={false}
                        className="font-mono text-[11px] tracking-[6px] text-dim"
                      >
                        ⋯
                      </Text>
                    </View>
                    <ScoreRow entry={userEntry} accentColor={accentColor} />
                  </>
                )}
              </View>
            )
          })}
        </ScrollView>
      </View>
    </View>
  )
}

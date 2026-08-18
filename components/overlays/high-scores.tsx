import { useFonts } from 'expo-font'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { mono, ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { useBoardContext, type PeriodBoard } from '@/hooks/use-board'
import { useOnline } from '@/hooks/use-online'
import { useViewport } from '@/hooks/use-viewport'
import { type LeaderboardTab } from '@/lib/leaderboard'
import { longestMedalTab, type TabRank } from '@/lib/medals'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

import { OfflineNotice } from './offline-notice'
import { PublishScoresButton } from './publish-scores-button'
import { TabMedal } from './tab-medal'
import { TabPanel } from './tab-panel'

const TABS: { key: LeaderboardTab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'week', label: 'THIS WEEK' },
  { key: 'forever', label: 'EVER' },
]

// `longestMedalTab` takes exactly the two fields it needs to judge a rank, not the
// whole `MyRankRow` — so a caller cannot slip in a rank read off a different board by
// mistake.
//
// `runScore` restricts this to a medal the run just played actually holds. Without
// it, a board a player medalled on days ago keeps qualifying on every later finish —
// their standing there is still true, but it has nothing to do with the run on
// screen, and "ever" or "week" being pinned by an old best forgot on every other run
// is what "reach a medal" is not supposed to mean. `myBest` already folds in local
// scores on top of the server's, so this compares against the higher of the two.
const rankOf = (period: PeriodBoard, runScore: number | undefined): TabRank => {
  if (period.myRank === null) return null
  if (runScore !== undefined && runScore < period.myBest) return null
  return { rank: period.myRank.rank, score: period.myRank.best_score }
}

export function HighScores({
  gameMode,
  userId,
  nickname,
  onAddNickname,
  halo = false,
  compact = false,
  pinMedalTab = false,
  runScore,
}: {
  gameMode: Mode
  userId: string | null
  nickname: string | null
  // Opens the nickname prompt so the player's local bests can be published. Omitted
  // by the game over screen, which asks for a nickname of its own accord the moment
  // the run ends — a button offering the prompt behind it would be the same question
  // twice.
  onAddNickname?: () => void
  // Set on the gold game-over screen, where the board sits on the celebration.
  halo?: boolean
  // Short board: three rows and no row below the cut. See TabPanel.
  compact?: boolean
  // The game-over screen's own request: once the run just played lands the player on
  // a podium somewhere, stop cycling tabs and hold on the longest board that does —
  // a medal is worth seeing without having to catch it mid-rotation. Off everywhere
  // else, where the tabs are a tour of boards the player may not be on at all.
  pinMedalTab?: boolean
  // The score the run that just ended posted — required to make sense of
  // `pinMedalTab`, since a medal only counts as reached when this run is the one
  // holding it. Omitted anywhere pinning is off.
  runScore?: number
}) {
  // Loaded once here rather than per row: the board draws six of them, and every
  // score in the app wears the seven-segment face. `mono` stands in until it lands.
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const digitFont = dsegLoaded ? 'DSEG7' : mono
  // The tab labels and column headers sit straight on the gold, like the rows below.
  const glow = halo ? ON_GOLD_LABEL_SHADOW : null
  const { width: windowWidth } = useViewport()
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

  const online = useOnline()

  // The one board store, shared with the intro, the pause screen and the strip above
  // the dial. Each period already carries what the device holds beyond what the server
  // does, so there is nothing to fold in here and no way for two screens to disagree.
  const board = useBoardContext()
  const dataByTab: Record<LeaderboardTab, PeriodBoard> = {
    today: board.today,
    week: board.week,
    forever: board.forever,
  }
  const hasUnpublished = board.forever.unpublished !== null

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

  // Memoised so the pinning effect below can depend on it without firing on every
  // render — it only changes identity when the layout it scrolls against does.
  const goToTab = useCallback(
    (key: LeaderboardTab) => {
      autoplayRef.current = false
      const index = TABS.findIndex((t) => t.key === key)
      activeIndexRef.current = index
      setActiveTab(key)
      scrollRef.current?.scrollTo({ x: index * effectiveWidth, animated: true })
    },
    [effectiveWidth],
  )

  // The board this run just played is not settled the instant the game-over screen
  // appears — the score is still in flight to the server, and `myRank` here is
  // whatever the board last reported before that landed. This recomputes on every
  // render, so it catches up the moment the submit's realtime nudge refreshes the
  // board — see hooks/use-board.ts.
  const medalTab = pinMedalTab
    ? longestMedalTab({
        today: rankOf(dataByTab.today, runScore),
        week: rankOf(dataByTab.week, runScore),
        forever: rankOf(dataByTab.forever, runScore),
      })
    : null

  // Fires once the medal becomes visible and stops autoplay the same way a tap does,
  // so nothing pulls the tabs back into rotation afterward. Only re-fires if the medal
  // tab itself changes — a later refresh naming a *different*, longer board — which
  // means a player who has since navigated away can be pulled back once more. That is
  // the one case pinning is worth overriding a manual choice for: the board just
  // named is a truer answer than the one shown a moment ago.
  useEffect(() => {
    if (medalTab === null) return
    goToTab(medalTab)
  }, [medalTab, goToTab])

  return (
    <View className="mb-5 w-full max-w-3xs self-center">
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
                style={glow}
              >
                {label}
              </Text>
              {/* Says the player holds a place on this period without their having to
                  open it — the tabs rotate, so a medal on a tab they are not looking at
                  would otherwise go unseen. */}
              <TabMedal myRank={dataByTab[key].myRank} />
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
          style={glow}
        >
          #
        </Text>
        <Text
          selectable={false}
          className="flex-1 font-mono text-[8px] font-bold tracking-[1px] text-dim"
          style={glow}
        >
          NICK
        </Text>
        <Text
          selectable={false}
          className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
          style={glow}
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
              digitFont={digitFont}
              halo={halo}
              compact={compact}
            />
          ))}
        </ScrollView>
      </View>

      {!online && <OfflineNotice unsynced={hasUnpublished} />}

      {hasUnpublished && nickname === null && onAddNickname !== undefined && (
        <PublishScoresButton
          from={gradientColors[0]}
          to={gradientColors[1]}
          onPress={onAddNickname}
        />
      )}
    </View>
  )
}

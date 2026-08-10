import { useFonts } from 'expo-font'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { AnnouncementBar } from '@/components/game/announcement-bar'
import { BestScoreCell } from '@/components/game/best-score-cell'
import { SPECTRUM } from '@/constants/colors'
import { mono } from '@/constants/theme'
import type { Announcement } from '@/lib/announcements'
import { hasBestScore } from '@/lib/best-score'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

type BestKey = 'you' | 'today' | 'week' | 'ever'

// A score that survived the "is there anything to show?" filter.
type ShownBest = { key: BestKey; value: number }

const BEST_LABELS = {
  you: 'YOU',
  today: 'TODAY',
  week: 'WEEK',
  ever: 'EVER',
} as const satisfies Record<BestKey, string>

// One step along the game spectrum per score, coolest to hottest: your own best,
// then the day, the week, and all time.
const BEST_COLORS = {
  you: SPECTRUM[0],
  today: SPECTRUM[1],
  week: SPECTRUM[2],
  ever: SPECTRUM[3],
} as const satisfies Record<BestKey, string>

const BEST_ORDER = ['you', 'today', 'week', 'ever'] as const satisfies readonly BestKey[]

// The bar starts empty and reveals its scores five seconds into a run, so the first
// thing a player sees is the game rather than a row of other people's numbers. They
// drop in from above as they fade up. The countdown is tied to the run and not to
// mount: this component lives inside the always-mounted game Screen, so a mount
// timer would expire while the player was still on the menu overlay.
const REVEAL_DELAY_MS = 5000
const REVEAL_MS = 400
const DROP_FROM = -6

// The row's height is fixed so the empty bar reserves exactly the space the scores
// will occupy — otherwise the whole top bar would jump down when they appear.
const ROW_HEIGHT = 14

// A hairline strip above the top bar: the player's best on this board next to the
// day, week and all-time bests. Your own best always shows, as 0 until you set one.
// The three server-backed periods show nothing when they have no value, so offline
// or an untouched board simply leaves those slots bare rather than reading as zero
// leaderboards.
export function BestScoresLine({
  inRun,
  mode,
  announcement,
  yourBest,
  today,
  week,
  ever,
}: {
  // True for the whole of a run, pauses included, so resuming does not restart the
  // countdown — the same notion of "in a run" the menu button uses.
  inRun: boolean
  mode: Mode
  // While set, the bar carries this message instead of the scores.
  announcement: Announcement | null
  yourBest: number
  today: number | null
  week: number | null
  ever: number | null
}) {
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const [revealed, setRevealed] = useState(false)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(DROP_FROM)

  useEffect(() => {
    if (!inRun) {
      // Back to the menu or game over — reset so the next run reveals afresh.
      setRevealed(false)
      opacity.value = 0
      translateY.value = DROP_FROM
      return
    }
    const id = setTimeout(() => {
      setRevealed(true)
    }, REVEAL_DELAY_MS)
    return () => {
      clearTimeout(id)
    }
  }, [inRun, opacity, translateY])

  useEffect(() => {
    if (!revealed) return
    const timing = { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) }
    opacity.value = withTiming(1, timing)
    translateY.value = withTiming(0, timing)
  }, [revealed, opacity, translateY])

  const revealStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  // The rule fades in with the scores but holds still — a hairline sliding into
  // place reads as a glitch, where the numbers dropping in reads as motion.
  const ruleStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const values = {
    you: yourBest,
    today,
    week,
    ever,
  } as const satisfies Record<BestKey, number | null>

  const digitFont = dsegLoaded ? 'DSEG7' : mono
  // flatMap rather than filter so each surviving value is narrowed to a number.
  // The annotation is load-bearing: without it the two branches infer as a union
  // that collapses to `any` at the call site.
  const shown: ShownBest[] = revealed
    ? BEST_ORDER.flatMap((key): ShownBest[] => {
        if (key === 'you') return [{ key, value: yourBest }]
        const value = values[key]
        return hasBestScore(value) ? [{ key, value }] : []
      })
    : []

  const [from, to] = MODE_GRADIENT[mode]

  return (
    <View className="mb-1.5">
      <View style={{ height: ROW_HEIGHT }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
            revealStyle,
          ]}
          className="flex-row items-baseline justify-between"
        >
          {shown.map(({ key, value }) => (
            <BestScoreCell
              key={key}
              label={BEST_LABELS[key]}
              value={value}
              color={BEST_COLORS[key]}
              digitFont={digitFont}
            />
          ))}
        </Animated.View>
        {/* Covers the scores, and deliberately ignores the reveal gate — a record
            broken inside the first five seconds still deserves to be announced. */}
        {announcement !== null && (
          <AnnouncementBar message={announcement.message} from={from} to={to} />
        )}
      </View>
      <Animated.View className="mt-1 h-px bg-muted" style={ruleStyle} />
    </View>
  )
}

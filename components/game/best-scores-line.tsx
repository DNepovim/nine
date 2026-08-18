import { useFonts } from 'expo-font'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { AnnouncementBar } from '@/components/game/announcement-bar'
import { BestScoreCell } from '@/components/game/best-score-cell'
import { GOLD_INK, SPECTRUM } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { useOnline } from '@/hooks/use-online'
import { useTheme } from '@/hooks/use-theme'
import { announcementStyle } from '@/lib/announcement-style'
import type { Announcement } from '@/lib/announcements'
import type { Mode } from '@/machines/modes'

type BestKey = 'you' | 'today' | 'week' | 'ever'

// A score that survived the "is there anything to show?" filter.
type ShownBest = { key: BestKey; value: number; mine: boolean }

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

// The bar starts empty and reveals its scores a second and a half into a run, so the
// first thing a player sees is the game rather than a row of other people's numbers.
// They drop in from above as they fade up. If the board is still loading by then the
// reveal waits for it, rather than dropping in a row of zeroes and correcting itself a
// moment later — but never past REVEAL_MAX_MS, so a request that hangs cannot keep the
// strip empty for a whole run. The countdown is tied to the run and not to mount: this
// component lives inside the always-mounted game Screen, so a mount timer would expire
// while the player was still on the menu overlay.
const REVEAL_DELAY_MS = 1500
const REVEAL_MAX_MS = 5000
const REVEAL_MS = 400
const DROP_FROM = -6

// The row's height is fixed so the empty bar reserves exactly the space the scores
// will occupy — otherwise the whole top bar would jump down when they appear.
const ROW_HEIGHT = 14

// What the whole strip occupies: the row, the gap above its hairline, the rule
// itself, and the margin below. Exported because Trainee renders no strip, and
// the absolutely-positioned menu button has to come up by exactly this much to
// stay level with the NINE row — deriving it beats a second hard-coded number
// that would silently drift if any of these changed.
export const BEST_SCORES_HEIGHT = ROW_HEIGHT + 4 + 1 + 6

// A hairline strip above the top bar: the player's best on this board next to the
// day, week and all-time bests. Your own best always shows, as 0 until you set one —
// it lives on the device and needs no connection. An untouched board leaves its slot
// bare rather than reading as a zero leaderboard; offline replaces all three with one
// small note instead, since none of their numbers can be trusted right now.
export function BestScoresLine({
  inRun,
  mode,
  announcement,
  yourBest,
  loaded,
  today,
  week,
  ever,
  todayIsMine,
  weekIsMine,
  everIsMine,
}: {
  // True for the whole of a run, pauses included, so resuming does not restart the
  // countdown — the same notion of "in a run" the menu button uses.
  inRun: boolean
  // Drives the announcement bar's gradient — the mode and CTA scales are per-mode.
  mode: Mode
  // While set, the bar carries this message instead of the scores.
  announcement: Announcement | null
  yourBest: number
  // Whether the board's leaders have arrived — the reveal holds for them past the
  // delay. False for a board still loading, true once its fetch has settled either way.
  loaded: boolean
  today: number | null
  week: number | null
  ever: number | null
  // Whether each board's record is the player's own. The YOU cell needs no such flag —
  // it is labelled with whose it is.
  todayIsMine: boolean
  weekIsMine: boolean
  everIsMine: boolean
}) {
  const { colorScheme } = useTheme()
  const online = useOnline()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const [delayDone, setDelayDone] = useState(false)
  const [waitedOut, setWaitedOut] = useState(false)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(DROP_FROM)

  // Past the delay the scores wait on the board; past the cap they show regardless.
  const revealed = waitedOut || (delayDone && loaded)

  useEffect(() => {
    if (!inRun) {
      // Back to the menu or game over — reset so the next run reveals afresh.
      setDelayDone(false)
      setWaitedOut(false)
      opacity.value = 0
      translateY.value = DROP_FROM
      return
    }
    const delay = setTimeout(() => {
      setDelayDone(true)
    }, REVEAL_DELAY_MS)
    const cap = setTimeout(() => {
      setWaitedOut(true)
    }, REVEAL_MAX_MS)
    return () => {
      clearTimeout(delay)
      clearTimeout(cap)
    }
  }, [inRun, opacity, translateY])

  useEffect(() => {
    if (!revealed) return
    const timing = { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) }
    opacity.value = withTiming(1, timing)
    translateY.value = withTiming(0, timing)
  }, [revealed, opacity, translateY])

  // The bar has to outlive the announcement: when it clears, the last one stays on
  // screen in `shown` while its sweep wipes it away, and is dropped on onExited.
  const [pinned, setPinned] = useState<Announcement | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (announcement !== null) {
      setPinned(announcement)
      setLeaving(false)
      return
    }
    setLeaving(true)
  }, [announcement])

  // Stable identity: the bar restarts its wipe whenever this changes, and an inline
  // arrow would hand it a new one on every render — which is every score change.
  const handleExited = useCallback(() => {
    setPinned(null)
    setLeaving(false)
  }, [])

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

  const heldByMe = {
    you: false,
    today: todayIsMine,
    week: weekIsMine,
    ever: everIsMine,
  } as const satisfies Record<BestKey, boolean>

  const digitFont = dsegLoaded ? 'DSEG7' : mono
  const mineColor = GOLD_INK[colorScheme === 'dark' ? 'dark' : 'light']
  // An untouched board reads as 0 rather than vanishing and leaving a ragged row.
  // Offline, the three server-backed keys are dropped instead — see the note that
  // fills their place below — since a 0 there would misreport an empty board rather
  // than one that simply cannot be reached.
  const shownKeys = online ? BEST_ORDER : (['you'] as const satisfies readonly BestKey[])
  const shown: ShownBest[] = revealed
    ? shownKeys.map((key) => ({ key, value: values[key] ?? 0, mine: heldByMe[key] }))
    : []

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
          {shown.map(({ key, value, mine }) => (
            <BestScoreCell
              key={key}
              label={BEST_LABELS[key]}
              value={value}
              color={BEST_COLORS[key]}
              digitFont={digitFont}
              mine={mine}
              mineColor={mineColor}
            />
          ))}
          {revealed && !online && (
            <Text
              selectable={false}
              className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
            >
              — OFFLINE —
            </Text>
          )}
        </Animated.View>
        {/* Covers the scores, and deliberately ignores the reveal gate — a record
            broken before the scores appear still deserves to be announced. */}
        {pinned !== null && (
          <AnnouncementBar
            message={pinned.message}
            {...announcementStyle(pinned.id, mode)}
            leaving={leaving}
            onExited={handleExited}
          />
        )}
      </View>
      <Animated.View className="mt-1 h-px bg-muted" style={ruleStyle} />
    </View>
  )
}

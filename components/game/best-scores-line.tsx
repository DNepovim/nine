import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { AnnouncementBar } from '@/components/game/announcement-bar'
import { BestScoreCell } from '@/components/game/best-score-cell'
import type { AchievementId } from '@/constants/achievements'
import { GOLD_INK, SPECTRUM } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { useOnline } from '@/hooks/use-online'
import { useTheme } from '@/hooks/use-theme'
import { announcementStyle } from '@/lib/announcement-style'
import { RUN_SETTLE_MS, type Announcement } from '@/lib/announcements'
import { nearestRecord } from '@/lib/near-record'
import type { Mode } from '@/machines/modes'

type BestKey = 'you' | 'today' | 'week' | 'ever'

// A score that survived the "is there anything to show?" filter.
type ShownBest = { key: BestKey; value: number; mine: boolean }

const BEST_LABELS = {
  you: msg`YOU`,
  today: msg`TODAY`,
  week: msg`WEEK`,
  ever: msg`EVER`,
} as const satisfies Record<BestKey, MessageDescriptor>

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
//
// The delay is the run's settling beat, shared with the announcements that cover this
// same row: the numbers arriving and the bar finding its voice are one moment, not two.
const REVEAL_DELAY_MS = RUN_SETTLE_MS
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
const BEST_SCORES_HEIGHT = ROW_HEIGHT + 4 + 1 + 6

// A hairline strip above the top bar: the player's best on this board next to the
// day, week and all-time bests. Your own best always shows, as 0 until you set one —
// it lives on the device and needs no connection. An untouched board leaves its slot
// bare rather than reading as a zero leaderboard; offline replaces all three with one
// small note instead, since none of their numbers can be trusted right now.
export function BestScoresLine({
  inRun,
  mode,
  announcement,
  onOpenAchievement,
  score,
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
  // Tapping a line that names an achievement opens it. Only that one line answers: a
  // record is a moment with nothing behind it to read, where an achievement is a thing
  // the player keeps and the bar only has room for its name.
  onOpenAchievement: (id: AchievementId) => void
  // The live score — read only to find which of the four cells below is worth a
  // nudge, never displayed itself. See lib/near-record.ts.
  score: number
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
  const { t } = useLingui()
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

  // The next announcement is timed to take the bar exactly as this one's wipe lands, so
  // the two can arrive in either order by a frame. Read through a ref because the bar
  // holds this callback for the length of an animation, and a stale closure here would
  // drop a pin that had already been replaced.
  const announcementRef = useRef(announcement)
  announcementRef.current = announcement

  // Stable identity: the bar restarts its wipe whenever this changes, and an inline
  // arrow would hand it a new one on every render — which is every score change.
  const handleExited = useCallback(() => {
    // Something took the bar while this one was leaving. Unpinning now would throw it
    // away unshown, and nothing would put it back.
    if (announcementRef.current !== null) return
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
  // The achievement the bar is currently offering to open, if any. Nothing to open while
  // the line is wiping away: a message on its way out is not one to be asked about, and
  // the pause it would bring on would land after it had gone.
  const openable = leaving ? undefined : pinned?.achievement
  // Only once the run is actually chasing these numbers — mid-reveal or mid-announcement
  // is not the moment to also draw the eye toward one cell over the others.
  const nearKey =
    inRun && revealed && pinned === null
      ? nearestRecord(score, { you: yourBest, today, week, ever })
      : null

  // Trainee is practice against no board, so it has no scores to put here — but it
  // still occupies the strip's height. Everything above the dial is drawn from the same
  // leftover the dial is sized from, so a mode that gave this space back would get a
  // bigger dial than the others, and the dial has to be the same in every mode. After
  // the hooks, not before: the reveal timers run identically whatever the mode.
  if (mode === 'trainee') return <View style={{ height: BEST_SCORES_HEIGHT }} />

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
              label={t(BEST_LABELS[key])}
              value={value}
              color={BEST_COLORS[key]}
              digitFont={digitFont}
              mine={mine}
              mineColor={mineColor}
              pulsing={key === nearKey}
            />
          ))}
          {revealed && !online && (
            <Text
              selectable={false}
              className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
            >
              <Trans>— OFFLINE —</Trans>
            </Text>
          )}
        </Animated.View>
        {/* Covers the scores. Nothing reaches it before the reveal — the bar holds a
            run's first announcement for the same RUN_SETTLE_MS — but it ignores the
            gate all the same: a board that never loads must not also silence the bar. */}
        {pinned !== null && (
          <AnnouncementBar
            message={pinned.message}
            {...announcementStyle(pinned.id, mode)}
            leaving={leaving}
            onExited={handleExited}
          />
        )}
        {/* Over the bar rather than inside it: the bar is a wipe with a message clipped
            to a moving window, and a press target that grew with the window would be
            unhittable for the first frames of a line. The hit area is generous because
            the strip is a hairline — 14px is nothing to aim at with a thumb. */}
        {openable !== undefined && (
          <Pressable
            className="absolute inset-0"
            hitSlop={8}
            onPress={() => {
              onOpenAchievement(openable)
            }}
          />
        )}
      </View>
      <Animated.View className="mt-1 h-px bg-muted" style={ruleStyle} />
    </View>
  )
}

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { AnnouncementBar } from '@/components/game/announcement-bar'
import {
  BEST_CELL_HEIGHT,
  BestScoreCell,
  CELL_LINE,
  CELL_TEXT_SIZE,
} from '@/components/game/best-score-cell'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { TrackedPressable } from '@/components/tracked-pressable'
import type { AchievementId } from '@/constants/achievements'
import { APP_RED, GOLD_INK, SPECTRUM } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import type { RecordHolder } from '@/hooks/use-board'
import { useOnline } from '@/hooks/use-online'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import { announcementStyle } from '@/lib/announcement-style'
import { RUN_SETTLE_MS, type Announcement } from '@/lib/announcements'
import { cn } from '@/lib/cn'
import { nearestRecord } from '@/lib/near-record'
import { darkGradientOf, gradientOf, isChallenge, traitsOf, type ModeId } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// The four periods of a board, plus the one a **session** has instead of them. Never
// both: a mode either keeps a board or belongs to a session, and `traitsOf(mode).board`
// is the question that decides which face this strip wears.
type BestKey = 'you' | 'today' | 'week' | 'ever' | 'session'

// What a run that belongs to a session knows about it.
export type SessionBests = {
  // The top score on the session board, or 0 where nobody has posted one yet — the same
  // answer an untouched board gives, and drawn the same way.
  best: number
  // Who holds it, or null where the read has not landed or nobody holds it.
  holder: RecordHolder | null
  // Whether that top score is the player's own, which the cell says as YOU rather than
  // by printing the name they already know.
  mine: boolean
  // When the window shuts, ms since the epoch. The one figure on this strip that is not
  // a score.
  closesAt: number
}

// A score that survived the "is there anything to show?" filter, with whatever goes on
// the line under it: a player to name, or a word where a name would be the wrong thing
// to write. Never both, and never neither — see `secondLine`.
type ShownBest = {
  key: BestKey
  value: number
  mine: boolean
  holder: RecordHolder | null
  sub: string | null
  // Whose profile this cell opens, or null where there is nobody behind it to read.
  profileId: string | null
}

const BEST_LABELS = {
  you: msg`YOUR`,
  today: msg`TODAY`,
  week: msg`WEEK`,
  ever: msg`EVER`,
  // Not THIS CHALLENGE: the top bar two rows up already names the challenge, and the
  // cell has one short line to say which of the two scores beside it this is.
  session: msg`SESSION`,
} as const satisfies Record<BestKey, MessageDescriptor>

// The player's own cell is one phrase across the cell's two lines — YOUR / BEST — where
// the other three are a period over the player holding it. It reads as a label rather
// than as a name because that is what it is: the one score on this row that is not a
// record anybody holds, just the best the device remembers.
const YOUR_BEST = msg`BEST`

// A record the player holds names them as YOU. Their own nickname would be the board
// telling them who they are, and it is the only name on the row they already know.
const HELD_BY_ME = msg`YOU`

// One step along the game spectrum per score, coolest to hottest: your own best,
// then the day, the week, and all time.
const BEST_COLORS = {
  you: SPECTRUM[0],
  today: SPECTRUM[1],
  week: SPECTRUM[2],
  ever: SPECTRUM[3],
  // Overridden per challenge — see `cellColor`. The entry is here so the table stays
  // exhaustive over `BestKey`, and the stop is the one the four-cell row ends on, which
  // is what a lone second cell would want if a challenge ever had no colour of its own.
  session: SPECTRUM[3],
} as const satisfies Record<BestKey, string>

const BEST_ORDER = ['you', 'today', 'week', 'ever'] as const satisfies readonly BestKey[]

// What a session run shows instead: what the player has done, and what the session has.
// Two cells and not four, because a session has no day, week or all time to be the best
// of — it is its own window, which is the whole of why it needs none of the three.
const SESSION_ORDER = ['you', 'session'] as const satisfies readonly BestKey[]

// And what is left when the three server-backed cells cannot be reached.
const ONLY_YOURS = ['you'] as const satisfies readonly BestKey[]

// How wide the countdown's label is allowed to be, which is what makes it wrap to two
// lines. Nine characters at this size and tracking come to about forty points, so this
// is a little over one word's worth — wide enough that a word is never broken across a
// line, narrow enough that two never fit on one. Czech runs longer and lands on two the
// same way.
const LABEL_WIDTH = 46

// Which cells the row draws.
//
// A session run shows its own two whether or not the device is online: `you` is off the
// device and the session's best was read before the run was dealt, so neither is a thing
// the connection can take away mid-run. A board run offline drops the three that are the
// server's — a 0 there would misreport an empty board rather than an unreachable one.
const keysFor = (session: SessionBests | null, online: boolean): readonly BestKey[] => {
  if (session !== null) return SESSION_ORDER
  return online ? BEST_ORDER : ONLY_YOURS
}

// What a cell is painted in.
//
// The session cell wears the challenge's own colour rather than a stop off the game
// spectrum: the rest of the row is the app's scale, and this one cell is about the thing
// the run belongs to. `challengeInk` is the shade of that colour which carries a word.
const cellColor = (key: BestKey, mode: ModeId): string =>
  key === 'session' && isChallenge(mode)
    ? challengeInk(gradientOf(mode)[1])
    : BEST_COLORS[key]

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

// What the whole strip occupies: a hairline, the gap under it, the row of cells, the gap
// above the second hairline, that rule itself, and the margin below. The row is one cell
// high, and that height is the cell's to state — a label over a name, as tall as the
// number beside them. It is fixed either way, so the empty bar reserves exactly the space
// the scores will occupy rather than letting the whole top bar jump down when they appear.
//
// Exported because Trainee renders no strip, and the absolutely-positioned menu button
// has to come up by exactly this much to stay level with the NINE row — deriving it
// beats a second hard-coded number that would silently drift if any of these changed.
const BEST_SCORES_HEIGHT = 1 + 4 + BEST_CELL_HEIGHT + 4 + 1 + 6

// A hairline strip above the top bar: the player's best on this board next to the
// day, week and all-time bests. Your own best always shows, as 0 until you set one —
// it lives on the device and needs no connection. An untouched board leaves its slot
// bare rather than reading as a zero leaderboard; offline replaces all three with one
// small note instead, since none of their numbers can be trusted right now.
// What the countdown turns when the window shuts. `APP_RED` both ends — see the call site.
const SHUT_GRADIENT = [APP_RED, APP_RED] as const

export function BestScoresLine({
  inRun,
  mode,
  announcement,
  onOpenAchievement,
  onPause,
  viewerId,
  score,
  yourBest,
  loaded,
  today,
  week,
  ever,
  todayIsMine,
  weekIsMine,
  everIsMine,
  todayHolder,
  weekHolder,
  everHolder,
  session,
  onWindowShut,
}: {
  // The standings this run belongs to, where it belongs to a **session** rather than to
  // a board. Null for every ordinary run, which is what makes this the switch between
  // the strip's two faces.
  //
  // One object rather than four loose props, so there is no way to be holding a session's
  // best without the window it was set in — the two are drawn side by side and a cell
  // naming one without the other would be a figure with no contest behind it.
  session: SessionBests | null
  // Called once, on the tick the session's window shuts — and only ever for a run that
  // belongs to one.
  //
  // The countdown below already fires `onArrive` at that boundary, including on a mount
  // that is already past it, which is what a run resumed after the close looks like. The
  // red is this component's (it is the one holding the clock); the run ending is the
  // screen's, a second later. Two readers of one boundary rather than two clocks, so the
  // colour and the end can never disagree about when it was.
  onWindowShut: () => void
  // True for the whole of a run, pauses included, so resuming does not restart the
  // countdown — the same notion of "in a run" the menu button uses.
  inRun: boolean
  // Drives the announcement bar's gradient — the mode and CTA scales are per-mode.
  mode: ModeId
  // While set, the bar carries this message instead of the scores.
  announcement: Announcement | null
  // Tapping a line that names an achievement opens it. Only that one line answers: a
  // record is a moment with nothing behind it to read, where an achievement is a thing
  // the player keeps and the bar only has room for its name.
  onOpenAchievement: (id: AchievementId) => void
  // Stops the run, because tapping a name here opens a modal to read and a run does not
  // wait. The profile itself is opened from inside this component rather than handed up:
  // the provider that owns that modal is mounted below the game screen, so this is the
  // first place in the tree that can ask for it. The screen is left with the one half of
  // the gesture it alone can do.
  onPause: () => void
  // Who is looking, so the cell that says YOUR BEST can open their own profile — it is
  // the one score on the row with no board row behind it to name. Null before the
  // anonymous sign-in has landed, which takes the press off that cell and nothing else.
  viewerId: string | null
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
  // Who holds each board's record, with the averages their name is coloured by. Null for
  // a board with no record on it, or one whose rows have not arrived. The player's own
  // record is named by the flags above instead: a nickname is what the board calls
  // somebody else, and reading your own back at you is the one place it is the wrong word.
  todayHolder: RecordHolder | null
  weekHolder: RecordHolder | null
  everHolder: RecordHolder | null
}) {
  const { t } = useLingui()
  // **Which** window shut, not whether one did.
  //
  // A boolean here was wrong in a way that only showed up on the second challenge of a
  // sitting. This component lives inside the game screen's unconditional `<Screen>`, so it
  // is mounted for the whole life of the app and never remounts between runs — a `shut`
  // flag set when one window closed was still set when the next run started, and that run's
  // countdown was drawn in the closing red from its first frame, hours early.
  //
  // Storing the instant instead makes the answer *derived*: a later window has a different
  // `closesAt` and simply does not match, so there is no state to reset and no ordering to
  // get right. The countdown below is the one thing that does remount — it unmounts with
  // `session` between runs — which is why its own `arrived` ref was never affected.
  const [shutAt, setShutAt] = useState<number | null>(null)
  const openProfile = useOpenProfile()
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

  // The rules fade in with the scores but hold still — a hairline sliding into
  // place reads as a glitch, where the numbers dropping in reads as motion.
  const ruleStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const values = {
    you: yourBest,
    today,
    week,
    ever,
    session: session?.best ?? 0,
  } as const satisfies Record<BestKey, number | null>

  const heldByMe = {
    you: false,
    today: todayIsMine,
    week: weekIsMine,
    ever: everIsMine,
    session: session?.mine ?? false,
  } as const satisfies Record<BestKey, boolean>

  const holders = {
    you: null,
    today: todayHolder,
    week: weekHolder,
    ever: everHolder,
    session: session?.holder ?? null,
  } as const satisfies Record<BestKey, RecordHolder | null>

  // Whose profile each cell opens. A record the player holds resolves to the same id
  // either way — the board's top row *is* them — so ownership needs no case of its own.
  const profileIds = {
    you: viewerId,
    today: todayHolder?.userId ?? null,
    week: weekHolder?.userId ?? null,
    ever: everHolder?.userId ?? null,
    session: session?.holder?.userId ?? null,
  } as const satisfies Record<BestKey, string | null>

  // What goes under each label. Exactly one of the two is ever set: the player's own
  // cell and a record they hold say a word, every other cell draws a name, and a board
  // with no record at all leaves the line empty rather than inventing a holder for it.
  const secondLine = (key: BestKey): Pick<ShownBest, 'holder' | 'sub'> => {
    if (key === 'you') return { holder: null, sub: t(YOUR_BEST) }
    if (heldByMe[key]) return { holder: null, sub: t(HELD_BY_ME) }
    return { holder: holders[key], sub: null }
  }

  const digitFont = dsegLoaded ? 'DSEG7' : mono
  // An untouched board reads as 0 rather than vanishing and leaving a ragged row.
  // Offline, the three server-backed keys are dropped instead — see the note that
  // fills their place below — since a 0 there would misreport an empty board rather
  // than one that simply cannot be reached.
  const shownKeys = keysFor(session, online)
  const shown: ShownBest[] = revealed
    ? shownKeys.map((key) => ({
        key,
        value: values[key] ?? 0,
        mine: heldByMe[key],
        profileId: profileIds[key],
        ...secondLine(key),
      }))
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

  // The cells, named once so the two layouts below draw the same thing. A board run puts
  // them straight into the row so `justify-between` can spread them; a session run wraps
  // them, which is what holds the pair together on the left.
  //
  // **After `nearKey`, which it reads.** `.map` runs here rather than at render time, so
  // a `const` declared below this would be read inside its own dead zone — a
  // `ReferenceError` on every frame of the game screen. The compiler allows it: the
  // reference sits in an arrow function, which it has to assume might be called later.
  const cells = shown.map(({ key, value, mine, holder, sub, profileId }) => (
    <BestScoreCell
      key={key}
      label={t(BEST_LABELS[key])}
      value={value}
      color={cellColor(key, mode)}
      digitFont={digitFont}
      holder={holder}
      sub={sub}
      mine={mine}
      mineColor={GOLD_INK}
      pulsing={key === nearKey}
      // The run stops first. A profile is a card to read, and reading it while the
      // targets keep coming is losing a run to a tap.
      onPress={
        profileId === null
          ? undefined
          : () => {
              onPause()
              openProfile(profileId)
            }
      }
    />
  ))

  // Trainee is practice against no board, so it has no scores to put here. A challenge
  // has none either — its standings belong to its session — but a challenge run *in* a
  // session does: `session` carries them, and the row above draws two cells instead of
  // four. A challenge dealt outside one, from the challenge lab, falls through to the
  // blank below, which is right: it kept no board and posted to no standings.
  //
  // The strip still occupies its height when it is blank. Everything above the dial is
  // drawn from the same leftover the dial is sized from, so a mode that gave this space
  // back would get a bigger dial than the others, and the dial has to be the same in
  // every mode. After the hooks, not before: the reveal timers run identically whatever
  // the mode.
  if (!traitsOf(mode).board && session === null) {
    return <View style={{ height: BEST_SCORES_HEIGHT }} />
  }

  return (
    <View className="mb-1.5">
      {/* The strip closed on both sides: the same rule above the scores as below them,
          so the bar reads as a band of its own rather than as a lid on the top bar. */}
      <Animated.View className="mb-1 h-px bg-muted" style={ruleStyle} />
      <View style={{ height: BEST_CELL_HEIGHT }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
            revealStyle,
          ]}
          className="flex-row items-center justify-between"
        >
          {/* The scores, grouped **only** where there are two of them.
            
            The row is `justify-between`, which is right for a board's four cells: they
            spread across the strip and the eye reads them as a scale. Two cells spread
            that way sit a third of the strip apart with nothing between them, and
            `SESSION` drifts into the middle where it reads as its own thing rather than
            as the figure `YOUR BEST` is to be compared against. Grouped, they read as a
            pair and the countdown keeps the right-hand end.

            The grouping is a wrapper, so it has to be absent rather than merely gapless
            on a board run — a wrapper is one child, and four cells inside one child are
            four cells `justify-between` can no longer spread. That is what putting them
            in an unconditional box did: it packed the whole scale against the left. */}
          {session === null ? (
            cells
          ) : (
            <View className="flex-row items-center gap-5">{cells}</View>
          )}
          {/* What is left of the window, on the end of the row. The one figure here that
              is not a score, and the reason a challenge's strip is worth drawing at all
              while the run is going: the two numbers beside it say where the player
              stands, and this says how long they have to do something about it.

              Its own component so the second hand does not re-render the dial around it
              — see `ChallengeCountdown`, which exists for exactly that reason on the
              intro. */}
          {revealed && session !== null && (
            // The label **beside** the board rather than over it, which is the one way
            // both fit: a cell here is 15pt from its label's cap to its holder's foot,
            // and a caption stacked on a flap board comes to twenty-two. Side by side it
            // is the board's own height and nothing has to shrink.
            <View className="flex-row items-center gap-1.5">
              {/* **Closes**, not ends, and it names what closes. A run ends and a
                window closes, so the verb already keeps this off the clock beside it —
                but the subject is cheap here, and a bare CLOSES IN was a label the player
                had to work out from context. It is also the word the rest of this feature
                uses: `closesAt`, and the window that has shut.

                Two lines by wrapping rather than by two strings. A translator decides
                where a phrase breaks, and Czech does not break this one where English
                does. Built from the cell's own metrics, so the block comes to a cell's
                height exactly — see `CELL_TEXT_SIZE`. */}
              <Text
                selectable={false}
                numberOfLines={2}
                className="font-mono font-bold tracking-[0.5px] text-dim"
                style={{
                  fontSize: CELL_TEXT_SIZE,
                  lineHeight: CELL_LINE,
                  width: LABEL_WIDTH,
                }}
              >
                <Trans>CHALLENGE CLOSES IN</Trans>
              </Text>
              {/* The same board the intro's banner counts down on — flaps in this
                challenge's own CTA pair, turning as they change. It was a plain figure
                here, which made the one thing on this strip that is not a score look
                like one more of them. */}
              {/* Red the moment it reaches nought, and the run ends a second later —
                  see `EXPIRED_GRACE_MS`. The app's refusal ink, which is already what a
                  life coming off is drawn in: the one thing on this strip that is not a
                  score turning the one colour that means something has gone against you.
                  Both stops of the pair, so the flaps read as one slab of it rather than
                  as a gradient that happens to be warm. */}
              <ChallengeCountdown
                until={session.closesAt}
                gradient={
                  shutAt === session.closesAt ? SHUT_GRADIENT : darkGradientOf(mode)
                }
                // An inline closure on purpose: `ChallengeCountdown` holds this in a ref
                // and syncs it, precisely so a caller rebuilding it each render does not
                // tear its interval down. That is what lets this capture the window it
                // belongs to rather than reaching for it through a second ref.
                onArrive={() => {
                  setShutAt(session.closesAt)
                  // Only while there is a run for it to be about. `session` stays set
                  // through game over — it is cleared on reaching the intro — so without
                  // this a run that ended on its *lives* a few seconds before the close
                  // would have the boundary land on the game-over screen behind it, and
                  // the title would rewrite itself to say the window shut. It did not;
                  // the player ran out of hearts. The red is still correct either way,
                  // which is why only the call upward is gated.
                  if (inRun) onWindowShut()
                }}
                flip
              />
            </View>
          )}
          {revealed && !online && session === null && (
            <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
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
          <TrackedPressable
            id="best_scores.line"
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

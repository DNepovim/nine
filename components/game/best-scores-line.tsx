import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { AnnouncementBar } from '@/components/game/announcement-bar'
import { BEST_CELL_HEIGHT, BestScoreCell } from '@/components/game/best-score-cell'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { TrackedPressable } from '@/components/tracked-pressable'
import type { AchievementId } from '@/constants/achievements'
import { APP_RED, GOLD_INK } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { useBestsReveal } from '@/hooks/use-bests-reveal'
import type { RecordHolder } from '@/hooks/use-board'
import { useOnline } from '@/hooks/use-online'
import { usePinnedAnnouncement } from '@/hooks/use-pinned-announcement'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import { useLegible, useScheme } from '@/hooks/use-scheme'
import { announcementStyle } from '@/lib/announcement-style'
import { type Announcement } from '@/lib/announcements'
import {
  BEST_LABELS,
  BestKey,
  cellColor,
  HELD_BY_ME,
  keysFor,
  ShownBest,
  YOUR_BEST,
  type SessionBests,
} from '@/lib/best-scores'
import { cn } from '@/lib/cn'
import { formatRunClock } from '@/lib/duration'
import { nearestRecord } from '@/lib/near-record'
import { darkGradientOf, traitsOf, type ModeId } from '@/modes'

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
  const { revealed, revealStyle, ruleStyle } = useBestsReveal({ inRun, loaded })
  const { pinned, leaving, handleExited } = usePinnedAnnouncement(announcement)

  // The player's own figure: the session's row for them on a session run, the device's
  // best on this board otherwise — see `myBest` on `SessionBests`.
  const ownBest = session?.myBest ?? yourBest

  const values = {
    you: ownBest,
    today,
    week,
    ever,
    session: session?.best ?? 0,
    last: session?.last?.value ?? 0,
  } as const satisfies Record<BestKey, number | null>

  const heldByMe = {
    you: false,
    today: todayIsMine,
    week: weekIsMine,
    ever: everIsMine,
    session: session?.mine ?? false,
    last: session?.last?.mine ?? false,
  } as const satisfies Record<BestKey, boolean>

  const holders = {
    you: null,
    today: todayHolder,
    week: weekHolder,
    ever: everHolder,
    session: session?.holder ?? null,
    last: session?.last?.holder ?? null,
  } as const satisfies Record<BestKey, RecordHolder | null>

  // Whose profile each cell opens. A record the player holds resolves to the same id
  // either way — the board's top row *is* them — so ownership needs no case of its own.
  const profileIds = {
    you: viewerId,
    today: todayHolder?.userId ?? null,
    week: weekHolder?.userId ?? null,
    ever: everHolder?.userId ?? null,
    session: session?.holder?.userId ?? null,
    last: session?.last?.holder.userId ?? null,
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
        // A race's cells are clocks, drawn the way the stopwatch in the top bar
        // draws the figure they will be compared against.
        value:
          session?.measure === 'time'
            ? formatRunClock(values[key] ?? 0)
            : (values[key] ?? 0),
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
  //
  // Only where the cells are scores. A race's cells are clocks, and a hits session's are
  // counts too small for a fraction of them to be a nudge — under twenty hits, the 5% a
  // nudge allows is less than one. Neither has a live figure worth chasing.
  const nearKey =
    inRun &&
    revealed &&
    pinned === null &&
    (session === null || session.measure === 'score')
      ? nearestRecord(score, { you: ownBest, today, week, ever })
      : null

  // The cells, named once so the two layouts below draw the same thing. A board run puts
  // them straight into the row so `justify-between` can spread them; a session run wraps
  // them, which is what holds the pair together on the left.
  //
  // **After `nearKey`, which it reads.** `.map` runs here rather than at render time, so
  // a `const` declared below this would be read inside its own dead zone — a
  // `ReferenceError` on every frame of the game screen. The compiler allows it: the
  // reference sits in an arrow function, which it has to assume might be called later.
  // A challenge's ink is tuned for the light screen; on a dark **scheme** it may not read.
  const legible = useLegible()
  // The session countdown's flaps. A **monochrome** scheme has one colour to paint them in.
  const { mono: monoInk } = useScheme().inks
  const countdownGradient = (
    pair: readonly [string, string],
  ): readonly [string, string] => (monoInk === null ? pair : [monoInk, monoInk])
  const cells = shown.map(({ key, value, mine, holder, sub, profileId }) => (
    <BestScoreCell
      key={key}
      label={t(BEST_LABELS[key])}
      value={value}
      color={legible(cellColor(key, mode))}
      digitFont={digitFont}
      holder={holder}
      sub={sub}
      mine={mine}
      mineColor={legible(GOLD_INK)}
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
            // Closer with the last winner beside them: three cells and the countdown
            // have to share a phone's width where two had room to spare.
            <View
              className={cn(
                'flex-row items-center',
                session.last === null ? 'gap-5' : 'gap-3',
              )}
            >
              {cells}
            </View>
          )}
          {/* What is left of the window, on the end of the row. The one figure here that
              is not a score, and the reason a challenge's strip is worth drawing at all
              while the run is going: the two numbers beside it say where the player
              stands, and this says how long they have to do something about it.

              Its own component so the second hand does not re-render the dial around it
              — see `ChallengeCountdown`, which exists for exactly that reason on the
              intro. */}
          {revealed && session !== null && (
            <View className="flex-row items-center">
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
                closing
                gradient={countdownGradient(
                  shutAt === session.closesAt ? SHUT_GRADIENT : darkGradientOf(mode),
                )}
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

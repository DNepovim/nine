import Ionicons from '@expo/vector-icons/Ionicons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { isEmptyArray, isNonEmptyArray, isNonEmptyString } from 'narrowland'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { CardSection } from '@/components/overlays/card-section'
import { MedalLine } from '@/components/overlays/medal-line'
import { ModalCard } from '@/components/overlays/modal-card'
import { MottoModal } from '@/components/overlays/motto-modal'
import { BOARD_COLUMNS, ProfileBoardRow } from '@/components/overlays/profile-board-row'
import { ProfileMotto } from '@/components/overlays/profile-motto'
import { ProfileName } from '@/components/overlays/profile-name'
import { ProfileReignRow } from '@/components/overlays/profile-reign-row'
import { ProfileScore } from '@/components/overlays/profile-score'
import { ProfileSkeleton } from '@/components/overlays/profile-skeleton'
import { ShowMore } from '@/components/overlays/show-more'
import { StatCell } from '@/components/overlays/stat-cell'
import { TitleMark } from '@/components/overlays/title-mark'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { ACHIEVEMENT_COUNT } from '@/constants/achievements'
import { ACHIEVEMENT_INK, DIM_INK } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { useChampionsContext } from '@/hooks/use-champions'
import { usePlayerProfile } from '@/hooks/use-player-profile'
import { useViewport } from '@/hooks/use-viewport'
import { championMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { compactText } from '@/lib/compact-number'
import { formatCareerTime } from '@/lib/duration'
import { monthsSince } from '@/lib/format-date'
import { saveMotto } from '@/lib/leaderboard'
import { NO_FACTORS } from '@/lib/name-gradient'
import {
  boardRows,
  lifetimeOf,
  nameFactorsOf,
  type PlayerProfile,
} from '@/lib/player-profile'
import { codeOf, gradientOf, headlineOf, SCORED_MODES, type Headline } from '@/modes'

// The day the player joined. No profile carries a real join date yet, so every one of
// them reads the same day — the day profiles shipped — until the RPC can answer for it.
// The line is here for the same reason the counters' start date was: a player who has
// been at this a while should not read as someone who turned up this morning.
const JOINED_ON = '2026-09-22'

// How many stretches the MEDALS HELD, EVER list opens on. A prolific winner carries up to
// twenty of them — day boards mostly, one per day — and a table that long buries the
// BOARDS table above it under a scroll the reader has to climb back out of. Seven is the
// last week of them, which is what a glance at this list is asking about; the rest is a
// tap away.
const SHOWN_REIGNS = 7

// How the revealed tail arrives — the comparison table's own step and fade, so a list
// unfolding here beats at the rate a table assembling there does.
const STEP_MS = 18
const FADE_MS = 200

// The mark over the name, a little larger than the intro draws it over the title. The
// intro's has four glass letters under it to be read against; here it is the first thing
// on the card, with only 12px caps below, so the same size would read as a stray emoji.
const MARK_SIZE = 30

// Past this many months the line counts years instead. A profile two years old that said
// "joined 24 months ago" would be asking the reader to do the division.
const MONTHS_IN_YEAR = 12

// What each mode is judged on — the second line of both of its factor columns, the
// average and the best alike.
//
// Keyed by the factor and read through `headlineOf`, rather than keyed by the mode. The
// two coincide today only because both scored modes are named after the thing they
// measure; a mode scored on the route but called something else would still want ACC in
// this column. Which is also why it is not `codeOf` — a board code names the board, and
// this names the question the column is asking.
const FACTOR_CODE = {
  acc: msg`ACC`,
  spd: msg`SPD`,
} as const satisfies Record<Headline, MessageDescriptor>

// One column heading over the per-board table, stacked rather than spelled across.
//
// Two words on two lines for the same reason `StatCell` puts its label under its number:
// stacked, a column is as wide as its widest word instead of as wide as both put
// together. Four columns and a spelled difficulty is what a 320pt phone holds, and
// `BEST SCORE` on one line is the thing that does not fit in it.
//
// Bottom-aligned by the row, so a one-word heading sits on the same line as the second
// word of a two-word one and the headings read as a single band rather than as four
// labels at four heights.
function ColumnHead({
  width,
  top,
  bottom,
}: {
  // One of `BOARD_COLUMNS` — the widths are declared beside the row that has to match
  // them, never picked again here.
  width: string
  // Absent on a heading that is one word, which is then simply the only line.
  top?: string
  bottom: string
}) {
  return (
    <View className={cn(width, 'items-end')}>
      {top !== undefined && (
        <Text
          selectable={false}
          numberOfLines={1}
          className={cn(TYPE.caption, 'text-dim')}
        >
          {top}
        </Text>
      )}
      <Text selectable={false} numberOfLines={1} className={cn(TYPE.caption, 'text-dim')}>
        {bottom}
      </Text>
    </View>
  )
}

// One player, as every board in the app already knows them plus everything no board
// could say. Opened by tapping a name — on a leaderboard, the winners stripe, a
// multiplayer tile — and keyed by the user id that row was already carrying.
//
// A dialog rather than a screen, for the same reason the news is one: it is something
// you look at and dismiss, not somewhere you go. The game stays visible behind it.
//
// The same modal for the player holding the phone. A profile is public data about a
// player; that the player is you changes nothing about what it says.
export function PlayerProfileOverlay({
  userId,
  viewerId,
  onCompare,
  email,
  onOpenEmail,
  onClose,
}: {
  userId: string
  // Who is looking. Null before the anonymous sign-in has landed, which is the only
  // state where a player cannot yet be recognised as themselves.
  viewerId: string | null
  // Hands this profile up to be set against the viewer's own, with the id of the player it
  // belongs to: a profile says what someone has done and has never carried who they are,
  // and the comparison needs the id to ask whether they hold a board. Undefined where there
  // is nobody to set it against — before the sign-in has landed — which is also what takes
  // the button off the card.
  onCompare?: (userId: string, profile: PlayerProfile) => void
  // The player's own confirmed address, or null. Only ever drawn on their own card — an
  // address is the one thing about a player that is not public data about them.
  email: string | null
  onOpenEmail: () => void
  onClose: () => void
}) {
  const { t } = useLingui()
  const { height } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const digitFont = dsegLoaded ? 'DSEG7' : mono
  const { profile, loading, error, reload, applyMotto } = usePlayerProfile(userId)
  const [editingMotto, setEditingMotto] = useState(false)
  const [showAllReigns, setShowAllReigns] = useState(false)
  // The one thing this modal does differently for the player holding the phone. Every
  // number on it still reads the same either way — a profile is public data, and that it
  // is yours changes nothing about what it says, only about what you may rewrite.
  const isMine = viewerId !== null && viewerId === userId
  // Read from the context rather than fetched here: the two Extreme leaders are already
  // known and kept live off the board connection, and a second read would let this modal
  // contradict the row that opened it.
  const mark = championMark(userId, useChampionsContext())

  const lifetime = profile === null ? null : lifetimeOf(profile.totals, profile.winnings)
  const rows = profile === null ? [] : boardRows(profile)
  // Newest first already, so the opening slice is the most recent stretches — the ones a
  // player is most likely to still be holding, and the open one is the headline of the
  // list.
  const reigns = profile === null ? [] : profile.reigns
  const shownReigns = showAllReigns ? reigns : reigns.slice(0, SHOWN_REIGNS)
  const hiddenReigns = reigns.length - shownReigns.length
  // Both factors over every hit the player has landed, in either mode — the same pair
  // the game over screen shows for a single run, and the pair the name above is drawn in.
  const { avgAccuracy, avgSpeed } =
    lifetime === null ? NO_FACTORS : nameFactorsOf(lifetime)
  const percent = (value: number | null): string => (value === null ? '—' : `${value}%`)
  // A device running ahead of this build can hold an achievement this one has never heard
  // of, and the server counts what it was sent. Held to the catalogue so the pair always
  // reads as a fraction — this build cannot name more than it knows.
  const shownAchievements =
    profile === null ? 0 : Math.min(profile.achievements, ACHIEVEMENT_COUNT)

  // Read once when the modal opens rather than on every render. The answer changes once
  // a month, so nothing is lost by freezing it, and a clock read mid-render is a value
  // the compiler is free to take at a different moment than you meant.
  const [joinedMonths] = useState(() => monthsSince(JOINED_ON, new Date()))

  // The header asks the question the card answers, rather than labelling it: a PLAYER
  // label over the nickname only said what the line below it already said. Two
  // questions, because opening your own profile is a different act from opening a
  // stranger's — one is checking on yourself, the other is finding out who you lost to.
  return (
    <ModalCard
      title={isMine ? t`IS THAT YOU?` : t`WHO IS IT?`}
      onDismiss={onClose}
      maxHeight={height * 0.85}
    >
      {(close) => (
        <>
          {/* The card's whole body, in one scroll under a header that does not move.
              The header is `ModalCard`'s own row — the question and the 5-dot close —
              and it is the only thing here outside the scroll.

              It used to be three bands: the name pinned above a scrolling middle, the
              buttons pinned below it. That left the tallest part of the card, the part
              the player came to read, with the least room of the three on a short
              display, while the name and the buttons kept their full height. One scroll
              gives the figures the whole card and costs nothing — the way out is the
              cross in the fixed header, which is reachable at any scroll position.

              One rhythm for all of it: every item in this column is separated by the
              same gap, and nothing in it carries a margin of its own. The pieces that
              used to bring their own — the medal line, the motto — hand that back to
              their parent, so this column alone decides the spacing. The exception is
              `ProfileScore`, which pads itself; see the note on it.

              `flexShrink` lets a long profile scroll while a short one stays its own
              height — without it the ScrollView would claim the whole of the card's
              cap. The scroll edges are left flush so the rhythm does not change where
              the scrolling starts. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
          >
            <View className="gap-3">
              {/* The mark sits above the name, as it does on every row that wears one —
                and the same component the intro crowns its title with, so a tap on it
                answers the same question here. This is where the question is asked more
                often than anywhere else: on the intro the mark is your own and you at
                least know you took something, whereas a crown over a stranger's name is
                a stranger's crown, with nothing on the card to say what it took. */}
              {mark !== null && <TitleMark mark={mark} mine={isMine} size={MARK_SIZE} />}
              {/* The same two averages the stat row below prints, handed to the name so
                the colour and the numbers explaining it can never disagree. */}
              {profile !== null && (
                <ProfileName
                  nickname={profile.nickname ?? '…'}
                  avgAccuracy={avgAccuracy}
                  avgSpeed={avgSpeed}
                />
              )}
              {/* Between the name and the medals: the one line here the player wrote rather
                than earned. Editable only on your own profile, and only once you have a
                nickname — without one you are on no board, so there is no profile for a
                motto to appear on. */}
              {profile !== null && (
                <ProfileMotto
                  motto={profile.motto}
                  editable={isMine && isNonEmptyString(profile.nickname)}
                  onEdit={() => {
                    setEditingMotto(true)
                  }}
                />
              )}
              {/* How long they have been at this, under the name where the rest of who
                they are is. In months rather than on a date: a date is a fact to be
                looked up, and the only thing anyone reads it for is the answer this
                gives directly. Sentence case and narrow tracking, like the motto above
                it — the same reasoning, that a line of prose set in the house's wide
                caps reads as another heading.

                Sized under the motto rather than beside it. The motto is the line the
                player chose; this one is the app's footnote to the name, and the two
                sitting at the same weight would read as two mottos. */}
              {profile !== null && joinedMonths !== null && (
                <Text
                  selectable={false}
                  className={cn(TYPE.hint, 'text-center text-dim')}
                >
                  {joinedMonths < 1 ? (
                    <Trans>joined this month</Trans>
                  ) : joinedMonths < MONTHS_IN_YEAR ? (
                    <Plural
                      value={joinedMonths}
                      one="joined a month ago"
                      other="joined # months ago"
                    />
                  ) : (
                    <Plural
                      value={Math.floor(joinedMonths / MONTHS_IN_YEAR)}
                      one="joined a year ago"
                      other="joined # years ago"
                    />
                  )}
                </Text>
              )}
              {/* Under the name, the way the intro screen puts it under the title — same
                component, same one-per-mode reduction, so a player's medals read the
                same wherever they are drawn. */}
              {profile !== null && <MedalLine medals={profile.medals} />}

              {/* A profile nobody could read shows what went wrong and offers another
                  go. It never falls back to zeroes, which are indistinguishable from a
                  real player who has not played yet. */}
              {profile === null && error !== null && (
                <View className="items-center gap-3 py-4">
                  <Text
                    selectable={false}
                    className={cn(TYPE.proseSm, 'text-center text-dim')}
                  >
                    <Trans>This profile could not be loaded.</Trans>
                  </Text>
                  <TrackedPressable
                    id="profile.try_again"
                    onPress={reload}
                    className="items-center rounded-2xl bg-card px-6 py-3"
                  >
                    <Text selectable={false} className={cn(TYPE.heading, 'text-primary')}>
                      <Trans>TRY AGAIN</Trans>
                    </Text>
                  </TrackedPressable>
                </View>
              )}

              {/* The card's own shape while it is being read, rather than a word in
                  the middle of a card an eighth of its height — which then grew by the
                  other seven eighths the moment the profile landed. */}
              {profile === null && error === null && loading && <ProfileSkeleton />}

              {profile !== null && lifetime !== null && (
                <>
                  {/* The weighted total, not the raw one — Easy counts half and Extreme
                    double, so a career is judged by where it was spent rather than by
                    how long it was. FORTUNE and not SCORE because the per-board table
                    lower down still shows what each board was actually scored, and the
                    two numbers are not meant to add up to each other. */}
                  <ProfileScore score={lifetime.fortune} digitFont={digitFont} />

                  {/* Five cells rather than four, so the gap comes in a step: RUNS and
                    HITS count what happened, TIME says over how long, and the two
                    averages say how well. Which of the two a cell is comes off its own
                    kicker line rather than out of its label, so the labels are five bare
                    codes and the row reads as the two groups it is.

                    Back at the run stats' gap-5 now the labels have shed a word. It was
                    cut to gap-4 for the Czech, where PRŮM PŘES and PRŮM RYCH sat side by
                    side and ran the row out of room on a narrow phone; PŘES and RYCH
                    under a shared PRŮM are a third of that, and CELKEM over HRY is no
                    wider than ZÁSAHY already was. */}
                  <View className="w-full flex-row items-start justify-center gap-5">
                    {/* Shortened past a thousand, the way the fortune above them
                      already is: a career of 6 214 runs and 58 900 hits written out in
                      full would make those two cells several times as wide as the three
                      beside them, and the row is laid out to fit five. A lifetime total
                      is read for its size, not its last three digits. */}
                    <StatCell
                      label={t`RUNS`}
                      kicker={t`TOTAL`}
                      value={compactText(lifetime.runs)}
                    />
                    <StatCell
                      label={t`HITS`}
                      kicker={t`TOTAL`}
                      value={compactText(lifetime.hits)}
                    />
                    {/* A career with nothing counted says 0, not 0″. On the pause and
                      game over screens a duration of zero seconds is a real answer about
                      a real run; here it means no run has been timed yet, and a unit mark
                      on it dresses an absence as a measurement. The overhang goes with
                      the mark — a bare 0 has nothing hanging out, and pulling it left
                      anyway would sit it off centre over its own label.

                      Coarse, not the run stats' format: the largest unit a career has
                      reached and nothing under it, because nobody reads the minutes of
                      247ʰ38′12″ and a figure that long would be what sizes the row. */}
                    <StatCell
                      label={t`TIME`}
                      kicker={t`TOTAL`}
                      value={
                        lifetime.timeMs > 0 ? formatCareerTime(lifetime.timeMs) : '0'
                      }
                      overhang={lifetime.timeMs > 0}
                    />
                    {/* The same ACC and SPD the per-board table heads its factor
                      columns with, now that the kicker carries the AVG — one word for
                      what both of them are, said once above them. */}
                    <StatCell
                      label={t(FACTOR_CODE.acc)}
                      kicker={t`AVG`}
                      value={percent(avgAccuracy)}
                    />
                    <StatCell
                      label={t(FACTOR_CODE.spd)}
                      kicker={t`AVG`}
                      value={percent(avgSpeed)}
                    />
                  </View>

                  {/* Counted against the whole catalogue, the way the player's own
                    achievements screen counts it — and in the green nothing but an
                    achievement wears, so the one number here that cannot be taken away
                    does not read as another board stat. The server's count, even on your
                    own profile: what a device has earned but not yet synced is the
                    achievements screen's business, and a profile is what anyone tapping
                    the name would see. */}
                  <Text
                    selectable={false}
                    className={cn(TYPE.caption, 'text-center text-dim')}
                  >
                    <Trans>
                      <Text style={{ color: ACHIEVEMENT_INK }}>{shownAchievements}</Text>{' '}
                      OF {ACHIEVEMENT_COUNT} ACHIEVEMENTS
                    </Trans>
                  </Text>

                  {/* Both boards on one card, the way the comparison draws its own two
                    blocks: a mode heading and three difficulties under it is a table, and
                    two tables with nothing behind them read as six loose rows with a
                    coloured word every fourth. The tile is what says where one table ends.

                    One tile rather than two, because the heading inside each already names
                    its mode — a card apiece would be drawing the same boundary twice. */}
                  <CardSection label={t`BOARDS`}>
                    {SCORED_MODES.map((mode) => (
                      <View key={mode}>
                        {/* Taller than the rows under it, because these headings are two
                          lines where a row is one. */}
                        <View className="h-9 flex-row items-end">
                          {/* The board code rather than the mode spelled out. The
                            rows under it are the thing being read, and the four columns
                            of figures they need are what a narrow phone has room for —
                            ACC over them says as much as ACCURACY did, in the register
                            the medal line and the reign rows already name a board in.

                            Three points over the difficulty codes under it, which is
                            what makes it read as the head of them rather than as a
                            fourth row of the same list. Two codes a point apart in the
                            same weight is two rows; three points apart is a heading and
                            its rows. The colour was already saying mode where they say
                            difficulty — this says which of the two is being announced.

                            Its own width, with the slack pushed into the spacer beside
                            it, rather than a `flex-1` cell. Stretched across the gap the
                            code was the one thing in this row that could be asked to
                            give way, and a clipped board code is three letters short of
                            unreadable — it has no second half to guess the rest from the
                            way a spelled word does. Everything right of it is a fixed
                            width, so the slack has to live somewhere, and a spacer is
                            the one place it cannot cost anything. */}
                          <Text
                            selectable={false}
                            className={TYPE.button}
                            style={{ color: gradientOf(mode)[0] }}
                          >
                            {t(codeOf(mode))}
                          </Text>
                          <View className="flex-1" />
                          <ColumnHead width={BOARD_COLUMNS.runs} bottom={t`RUNS`} />
                          <ColumnHead
                            width={BOARD_COLUMNS.best}
                            top={t`BEST`}
                            bottom={t`SCORE`}
                          />
                          {/* The mode's own factor twice: how it usually goes, then
                            the once it all landed. Both second lines come from the same
                            message, so the pair can never end up asking about two
                            different things. */}
                          <ColumnHead
                            width={BOARD_COLUMNS.average}
                            top={t`AVG`}
                            bottom={t(FACTOR_CODE[headlineOf(mode)])}
                          />
                          <ColumnHead
                            width={BOARD_COLUMNS.bestFactor}
                            top={t`BEST`}
                            bottom={t(FACTOR_CODE[headlineOf(mode)])}
                          />
                        </View>
                        {rows
                          .filter((row) => row.mode === mode)
                          .map((row) => (
                            <ProfileBoardRow
                              key={row.difficulty}
                              mode={row.mode}
                              difficulty={row.difficulty}
                              runs={row.runs}
                              best={row.best}
                              average={row.average}
                              bestFactor={row.bestFactor}
                              medals={row.medals}
                            />
                          ))}
                      </View>
                    ))}
                  </CardSection>

                  {/* Omitted rather than shown empty: a heading over nothing reads as
                    something the player lost, which is exactly what it is not. */}
                  {isNonEmptyArray(profile.reigns) && (
                    <CardSection label={t`MEDALS HELD, EVER`}>
                      {shownReigns.map((held, index) => (
                        <Animated.View
                          key={`${held.period}:${held.mode}:${held.difficulty}:${held.from}`}
                          // Only what the toggle reveals arrives on an animation: the
                          // rows the card opens on come up with the card, and playing
                          // them in a second time underneath it would read as the list
                          // rebuilding itself. The delay counts from the first revealed
                          // row so the tail drops in one after another rather than as a
                          // block.
                          entering={
                            index < SHOWN_REIGNS
                              ? undefined
                              : FadeInDown.delay(
                                  (index - SHOWN_REIGNS) * STEP_MS,
                                ).duration(FADE_MS)
                          }
                        >
                          <ProfileReignRow
                            mode={held.mode}
                            difficulty={held.difficulty}
                            period={held.period}
                            from={held.from}
                            to={held.to}
                          />
                        </Animated.View>
                      ))}

                      {/* The way into the rest of the career, and back out of it. */}
                      {(hiddenReigns > 0 || showAllReigns) && (
                        <ShowMore
                          id="profile.show_more"
                          hidden={hiddenReigns}
                          expanded={showAllReigns}
                          onToggle={() => {
                            setShowAllReigns(!showAllReigns)
                          }}
                        />
                      )}
                    </CardSection>
                  )}

                  {lifetime.runs === 0 && isEmptyArray(profile.bests) && (
                    <Text
                      selectable={false}
                      className={cn(TYPE.value, 'text-center text-dim')}
                    >
                      <Trans>No runs counted yet.</Trans>
                    </Text>
                  )}
                </>
              )}
              {/* The one row that is only ever on your own card, at the end of the figures
                and directly above CLOSE — the one place on this card for the things you
                can do rather than the things you have done.

                One row rather than the two this started as. Adding an address and fetching
                a profile back turned out to be the same act from the player's side — *this
                is me* — and which of them actually happens is the server's answer to the
                address, asked on the card behind this one.

                An address is not part of a profile and is not drawn like one: a profile
                says what somebody has achieved and every line of it reads the same to
                whoever is looking. This is the one piece of the card that is private, and
                it is here rather than up with the name for that reason. */}
              {isMine && (
                <TrackedPressable
                  id="profile.email"
                  onPress={() => {
                    onOpenEmail()
                    close()
                  }}
                  className="items-center rounded-2xl bg-card px-6 py-3"
                >
                  <Text selectable={false} className={cn(TYPE.heading, 'text-primary')}>
                    {email === null ? <Trans>ADD AN EMAIL</Trans> : <Trans>EMAIL</Trans>}
                  </Text>
                  {/* The address itself under the label, where a player checks it rather than
                    reads it — which is why it is the only line on this card set in lower
                    case and narrow tracking. Wide caps would make an address into a
                    heading, and nobody can check a heading against their inbox.

                    Without one, the line has to carry both halves of what the row does, or
                    a player with a profile waiting on another phone has no way of knowing
                    this is the door to it. */}
                  <Text selectable={false} className={cn(TYPE.hint, 'mt-1 text-dim')}>
                    {email ?? t`Keep this profile, or bring back one from another phone`}
                  </Text>
                </TrackedPressable>
              )}

              {/* The way out, at the end of the card as well as in its corner. The 5-dot
                cross in the header is where a dialog is closed from; on a card this long
                it is also the one control that has scrolled a thumb's length away by the
                time you are done reading. The stronger fill under COMPARE WITH ME rather
                than beside it: closing is what you do here, comparing is what you might. */}
              <PrimaryButton
                id="profile.close"
                onPress={close}
                label={<Trans>CLOSE</Trans>}
              />

              {/* Under CLOSE rather than above it, and a link rather than a card row: the
                intro's own arrangement, where the one thing the screen asks for is a
                filled button and everything else is a dim word with an icon beside it in
                the row beneath. Comparing is what you might do here; closing is what you
                do, and the spelling says which is which.

                Only on someone else's card, and only once the viewer is known — a table
                of a player against themselves has a winner on no row and nothing to
                say. */}
              {profile !== null && !isMine && onCompare !== undefined && (
                <View className="flex-row items-center justify-center">
                  <TrackedPressable
                    id="profile.action"
                    hitSlop={10}
                    onPress={() => {
                      // The table takes this profile's place rather than opening over it:
                      // the two say the same things about the same player, and stacking one
                      // on the other left the player two cards deep to get back out of.
                      // Asked for before `close`, so the comparison is already fading up as
                      // this card fades out — the cross-fade a screen change makes, in a
                      // dialog.
                      onCompare(userId, profile)
                      close()
                    }}
                  >
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="git-compare-outline" size={11} color={DIM_INK} />
                      <Text
                        selectable={false}
                        className={cn(TYPE.quietAction, 'text-dim')}
                      >
                        <Trans>COMPARE WITH ME</Trans>
                      </Text>
                    </View>
                  </TrackedPressable>
                </View>
              )}
            </View>
          </ScrollView>

          {editingMotto && profile !== null && (
            <MottoModal
              motto={profile.motto}
              onSave={async (next) => {
                const res = await saveMotto(userId, next)
                if (res.error === null) {
                  // Applied to what is already on screen rather than refetched: the write
                  // has landed, and the profile behind this modal differs from the one
                  // already drawn by exactly this line.
                  applyMotto(next)
                  setEditingMotto(false)
                }
                return res
              }}
              onCancel={() => {
                setEditingMotto(false)
              }}
            />
          )}
        </>
      )}
    </ModalCard>
  )
}

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { isEmptyArray, isNonEmptyArray, isNonEmptyString } from 'narrowland'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { MedalLine } from '@/components/overlays/medal-line'
import { ModalCard } from '@/components/overlays/modal-card'
import { MottoModal } from '@/components/overlays/motto-modal'
import { BOARD_COLUMNS, ProfileBoardRow } from '@/components/overlays/profile-board-row'
import { ProfileMotto } from '@/components/overlays/profile-motto'
import { ProfileName } from '@/components/overlays/profile-name'
import { ProfileReignRow } from '@/components/overlays/profile-reign-row'
import { ProfileScore } from '@/components/overlays/profile-score'
import { StatCell } from '@/components/overlays/stat-cell'
import { TitleMark } from '@/components/overlays/title-mark'
import { TrackedPressable } from '@/components/tracked-pressable'
import { ACHIEVEMENT_COUNT } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { useChampionsContext } from '@/hooks/use-champions'
import { usePlayerProfile } from '@/hooks/use-player-profile'
import { useTheme } from '@/hooks/use-theme'
import { useViewport } from '@/hooks/use-viewport'
import { championMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { compactText } from '@/lib/compact-number'
import { formatGameTime } from '@/lib/duration'
import { monthsSince } from '@/lib/format-date'
import { saveMotto } from '@/lib/leaderboard'
import { NO_FACTORS } from '@/lib/name-gradient'
import {
  boardRows,
  lifetimeOf,
  nameFactorsOf,
  type PlayerProfile,
} from '@/lib/player-profile'
import { gradientOf, labelOf, SCORED_MODES, type ScoredMode } from '@/modes'

// The day the player joined. No profile carries a real join date yet, so every one of
// them reads the same day — the day profiles shipped — until the RPC can answer for it.
// The line is here for the same reason the counters' start date was: a player who has
// been at this a while should not read as someone who turned up this morning.
const JOINED_ON = '2026-09-22'

// The mark over the name, a little larger than the intro draws it over the title. The
// intro's has four glass letters under it to be read against; here it is the first thing
// on the card, with only 12px caps below, so the same size would read as a stray emoji.
const MARK_SIZE = 30

// Past this many months the line counts years instead. A profile two years old that said
// "joined 24 months ago" would be asking the reader to do the division.
const MONTHS_IN_YEAR = 12

// What each mode is judged on — the second line of both of its factor columns, the
// average and the best alike.
const FACTOR_LABEL = {
  accuracy: msg`ACC`,
  speed: msg`SPD`,
} as const satisfies Record<ScoredMode, MessageDescriptor>

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
          className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
        >
          {top}
        </Text>
      )}
      <Text
        selectable={false}
        numberOfLines={1}
        className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
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
  onClose,
}: {
  userId: string
  // Who is looking. Null before the anonymous sign-in has landed, which is the only
  // state where a player cannot yet be recognised as themselves.
  viewerId: string | null
  // Hands this profile up to be set against the viewer's own. Undefined where there is
  // nobody to set it against — before the sign-in has landed — which is also what takes
  // the button off the card.
  onCompare?: (profile: PlayerProfile) => void
  onClose: () => void
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()
  const { height } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const digitFont = dsegLoaded ? 'DSEG7' : mono
  const { profile, loading, error, reload, applyMotto } = usePlayerProfile(userId)
  const [editingMotto, setEditingMotto] = useState(false)
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

  // No title on the card: its first line is the player's own name, and a PLAYER label
  // over it was the header saying what the line below it already said.
  return (
    <ModalCard onDismiss={onClose} maxHeight={height * 0.85}>
      {(close) => (
        <>
          {/* One rhythm for the whole modal: every item in this column is separated by
              the same gap, and nothing in it carries a margin of its own. The pieces
              that used to bring their own — the medal line, the motto — hand that back
              to their parent now, so this column alone decides the spacing.

              `shrink` because the ScrollView below still has to give way inside the
              card's own height cap. */}
          <View className="shrink gap-3">
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
                className="text-center font-mono text-[9px] tracking-[0.3px] text-dim"
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

            {/* flexShrink lets a long profile scroll while a short one stays its own
                height — without it the ScrollView would claim the whole cap. The inner
                column carries the gap; the scroll edges are left flush so the rhythm
                does not change where the scrolling starts. */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 1 }}
            >
              <View className="gap-3">
                {/* A profile nobody could read shows what went wrong and offers another
                  go. It never falls back to zeroes, which are indistinguishable from a
                  real player who has not played yet. */}
                {profile === null && error !== null && (
                  <View className="items-center gap-3 py-4">
                    <Text
                      selectable={false}
                      className="text-center font-mono text-[11px] text-dim"
                    >
                      <Trans>This profile could not be loaded.</Trans>
                    </Text>
                    <TrackedPressable
                      id="profile.try_again"
                      onPress={reload}
                      className="items-center rounded-2xl bg-card px-6 py-3"
                    >
                      <Text
                        selectable={false}
                        className="font-mono text-[11px] font-black tracking-[2px] text-primary"
                      >
                        <Trans>TRY AGAIN</Trans>
                      </Text>
                    </TrackedPressable>
                  </View>
                )}

                {profile === null && error === null && loading && (
                  <Text
                    selectable={false}
                    className="py-6 text-center font-mono text-[11px] text-dim"
                  >
                    <Trans>LOADING…</Trans>
                  </Text>
                )}

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
                    averages say how well. The Czech labels are the widest — PRŮM PŘES
                    twice over — and at gap-5 the row ran out of room on a narrow
                    phone. */}
                    <View className="w-full flex-row items-start justify-center gap-4">
                      {/* Shortened past a thousand, the way the fortune above them
                      already is: a career of 6 214 runs and 58 900 hits written out in
                      full would make those two cells several times as wide as the three
                      beside them, and the row is laid out to fit five. A lifetime total
                      is read for its size, not its last three digits. */}
                      <StatCell label={t`RUNS`} value={compactText(lifetime.runs)} />
                      <StatCell label={t`HITS`} value={compactText(lifetime.hits)} />
                      {/* A career with nothing counted says 0, not 0″. On the pause and
                      game over screens a duration of zero seconds is a real answer about
                      a real run; here it means no run has been timed yet, and a unit mark
                      on it dresses an absence as a measurement. The overhang goes with
                      the mark — a bare 0 has nothing hanging out, and pulling it left
                      anyway would sit it off centre over its own label. */}
                      <StatCell
                        label={t`TIME`}
                        value={
                          lifetime.timeMs > 0 ? formatGameTime(lifetime.timeMs) : '0'
                        }
                        overhang={lifetime.timeMs > 0}
                      />
                      <StatCell label={t`AVG ACC`} value={percent(avgAccuracy)} />
                      <StatCell label={t`AVG SPD`} value={percent(avgSpeed)} />
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
                      className="text-center font-mono text-[8px] font-bold tracking-[1px] text-dim"
                    >
                      <Trans>
                        <Text style={{ color: ACHIEVEMENT_INK[colorScheme] }}>
                          {shownAchievements}
                        </Text>{' '}
                        OF {ACHIEVEMENT_COUNT} ACHIEVEMENTS
                      </Trans>
                    </Text>

                    {SCORED_MODES.map((mode) => (
                      <View key={mode}>
                        {/* Taller than the rows under it, because these headings are two
                        lines where a row is one. */}
                        <View className="h-9 flex-row items-end">
                          <Text
                            selectable={false}
                            numberOfLines={1}
                            className="flex-1 font-mono text-[11px] font-black tracking-[2px]"
                            style={{ color: gradientOf(mode)[0] }}
                          >
                            {t(labelOf(mode))}
                          </Text>
                          <ColumnHead width={BOARD_COLUMNS.runs} bottom={t`RUNS`} />
                          <ColumnHead
                            width={BOARD_COLUMNS.best}
                            top={t`BEST`}
                            bottom={t`SCORE`}
                          />
                          {/* The mode's own factor twice: how it usually goes, then the
                          once it all landed. Both second lines come from the same
                          message, so the pair can never end up asking about two
                          different things. */}
                          <ColumnHead
                            width={BOARD_COLUMNS.average}
                            top={t`AVG`}
                            bottom={t(FACTOR_LABEL[mode])}
                          />
                          <ColumnHead
                            width={BOARD_COLUMNS.bestFactor}
                            top={t`BEST`}
                            bottom={t(FACTOR_LABEL[mode])}
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
                            />
                          ))}
                      </View>
                    ))}

                    {/* Omitted rather than shown empty: a heading over nothing reads as
                      something the player lost, which is exactly what it is not. */}
                    {isNonEmptyArray(profile.reigns) && (
                      <View>
                        <View className="h-7 flex-row items-end">
                          <Text
                            selectable={false}
                            className="font-mono text-[9px] font-black tracking-[2px] text-dim"
                          >
                            <Trans>RECORDS HELD, EVER</Trans>
                          </Text>
                        </View>
                        {profile.reigns.map((reign) => (
                          <ProfileReignRow
                            key={`${reign.mode}:${reign.difficulty}:${reign.tookAt}`}
                            mode={reign.mode}
                            difficulty={reign.difficulty}
                            score={reign.score}
                            tookAt={reign.tookAt}
                            lostAt={reign.lostAt}
                          />
                        ))}
                      </View>
                    )}

                    {lifetime.runs === 0 && isEmptyArray(profile.bests) && (
                      <Text
                        selectable={false}
                        className="text-center font-mono text-[10px] text-dim"
                      >
                        <Trans>No runs counted yet.</Trans>
                      </Text>
                    )}
                  </>
                )}
              </View>
            </ScrollView>

            {/* Below the scroll rather than at the end of it: a career long enough to
                scroll is exactly the one worth measuring yourself against, and a button
                that had to be scrolled to would be hidden on precisely those profiles.

                Only on someone else's, and only once the viewer is known — a table of a
                player against themselves has a winner on no row and nothing to say. */}
            {profile !== null && !isMine && onCompare !== undefined && (
              <TrackedPressable
                id="profile.action"
                onPress={() => {
                  // The table takes this profile's place rather than opening over it: the
                  // two say the same things about the same player, and stacking one on the
                  // other left the player two cards deep to get back out of. Asked for
                  // before `close`, so the comparison is already fading up as this card
                  // fades out — the cross-fade a screen change makes, in a dialog.
                  onCompare(profile)
                  close()
                }}
                className="items-center rounded-2xl bg-card px-6 py-3"
              >
                <Text
                  selectable={false}
                  className="font-mono text-[11px] font-black tracking-[2px] text-primary"
                >
                  <Trans>COMPARE WITH ME</Trans>
                </Text>
              </TrackedPressable>
            )}

            {/* The way out, at the end of the card as well as in its corner. The 5-dot
                cross in the header is where a dialog is closed from; on a card this long
                it is also the one control that has scrolled a thumb's length away by the
                time you are done reading. The stronger fill under COMPARE WITH ME rather
                than beside it: closing is what you do here, comparing is what you might. */}
            <TrackedPressable
              id="profile.close"
              onPress={close}
              className="items-center rounded-2xl bg-strong py-3.5"
            >
              <Text
                selectable={false}
                className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
              >
                <Trans>CLOSE</Trans>
              </Text>
            </TrackedPressable>
          </View>

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

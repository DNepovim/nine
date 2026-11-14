import Ionicons from '@expo/vector-icons/Ionicons'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { isEmptyArray, isNonEmptyArray, isNonEmptyString } from 'narrowland'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { CardModal } from '@/components/overlays/card-modal'
import { CardSection } from '@/components/overlays/card-section'
import { MedalLine } from '@/components/overlays/medal-line'
import { ModalCard } from '@/components/overlays/modal-card'
import { MottoModal } from '@/components/overlays/motto-modal'
import { NicknameModal } from '@/components/overlays/nickname-modal'
import { ProfileBoards } from '@/components/overlays/profile-boards'
import { ProfileEmail } from '@/components/overlays/profile-email'
import { ProfileMotto } from '@/components/overlays/profile-motto'
import { ProfileName } from '@/components/overlays/profile-name'
import { ProfilePlaceRow } from '@/components/overlays/profile-place-row'
import { ProfileReigns } from '@/components/overlays/profile-reigns'
import { ProfileScore } from '@/components/overlays/profile-score'
import { ProfileSkeleton } from '@/components/overlays/profile-skeleton'
import { ProfileStatCells } from '@/components/overlays/profile-stat-cells'
import { ProfileTenure } from '@/components/overlays/profile-tenure'
import { TitleMark } from '@/components/overlays/title-mark'
import { TrackedPressable } from '@/components/tracked-pressable'
import { ACHIEVEMENT_COUNT } from '@/constants/achievements'
import { DIM_INK } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { useChampionsContext } from '@/hooks/use-champions'
import { usePlayerProfile } from '@/hooks/use-player-profile'
import { useViewport } from '@/hooks/use-viewport'
import { playerMarks } from '@/lib/champions'
import { cn } from '@/lib/cn'
import { daysSince, formatShortDate, monthsSince } from '@/lib/format-date'
import { saveMotto } from '@/lib/leaderboard'
import { NO_FACTORS } from '@/lib/name-gradient'
import {
  boardRows,
  lifetimeOf,
  nameFactorsOf,
  type PlayerProfile,
} from '@/lib/player-profile'

// The day the player joined. No profile carries a real join date yet, so every one of
// them reads the same day — the day profiles shipped — until the RPC can answer for it.
// The line is here for the same reason the counters' start date was: a player who has
// been at this a while should not read as someone who turned up this morning.
const JOINED_ON = '2026-09-22'

// The mark over the name, a little larger than the intro draws it over the title. The
// intro's has four glass letters under it to be read against; here it is the first thing
// on the card, with only 12px caps below, so the same size would read as a stray emoji.
const MARK_SIZE = 30

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
  pendingEmail,
  onOpenEmail,
  onEnterCode,
  onRename,
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
  // The address given and not yet proved, which is its own state at the foot of the card
  // rather than the same as having none — see `ProfileEmail`.
  pendingEmail: string | null
  onOpenEmail: () => void
  // Back to the six digits for the address above, for a player who walked away from them.
  onEnterCode: () => void
  // Writing the nickname. Only ever called from the player's own card, and the one write
  // on this modal that is not about the profile being *read* — which is why it comes from
  // above rather than from the profile hook: the name lives on the session as well as on
  // the row, and auth owns that.
  onRename: (name: string) => Promise<{ error: string | null }>
  onClose: () => void
}) {
  const { t } = useLingui()
  const { height } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const digitFont = dsegLoaded ? 'DSEG7' : mono
  const { profile, loading, error, reload, patch } = usePlayerProfile(userId)
  const [editingMotto, setEditingMotto] = useState(false)
  const [editingName, setEditingName] = useState(false)
  // The one thing this modal does differently for the player holding the phone. Every
  // number on it still reads the same either way — a profile is public data, and that it
  // is yours changes nothing about what it says, only about what you may rewrite.
  const isMine = viewerId !== null && viewerId === userId
  // Read from the context rather than fetched here: the two Extreme leaders are already
  // known and kept live off the board connection, and a second read would let this modal
  // contradict the row that opened it.
  const marks = playerMarks(userId, useChampionsContext())

  const lifetime =
    profile === null
      ? null
      : lifetimeOf(profile.totals, profile.winnings, profile.sessions)
  const rows = profile === null ? [] : boardRows(profile)
  // Both factors over every hit the player has landed, in either mode — the same pair
  // the game over screen shows for a single run, and the pair the name above is drawn in.
  const { avgAccuracy, avgSpeed } =
    lifetime === null ? NO_FACTORS : nameFactorsOf(lifetime)
  // A device running ahead of this build can hold an achievement this one has never heard
  // of, and the server counts what it was sent. Held to the catalogue so the pair always
  // reads as a fraction — this build cannot name more than it knows.
  const shownAchievements =
    profile === null ? 0 : Math.min(profile.achievements, ACHIEVEMENT_COUNT)

  // Read once when the modal opens rather than on every render. The answer changes once
  // a month, so nothing is lost by freezing it, and a clock read mid-render is a value
  // the compiler is free to take at a different moment than you meant.
  const [openedAt] = useState(() => new Date())
  const [joinedMonths] = useState(() => monthsSince(JOINED_ON, openedAt))
  // Against the same frozen moment, but worked out on render: the last run arrives with
  // the profile, after the modal has opened.
  const lastRunDays =
    profile?.lastRunAt == null ? null : daysSince(profile.lastRunAt, openedAt)
  const lastRunDay = profile?.lastRunAt == null ? '' : formatShortDate(profile.lastRunAt)

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
          {/* Everything the player came to read, in one scroll between two bands that do
              not move: `ModalCard`'s own header above — the question and the 5-dot
              close — and the footer below.

              The name used to be pinned up here too, which left the tallest part of the
              card, the part the player came to read, with the least room on a short
              display while a band that could not scroll kept its full height. The name
              scrolls with the career it belongs to; the two controls do not, because
              they are what you do when you have finished reading and a button you have
              to scroll back down to is a button you go looking for.

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
              {/* One apiece rather than a string of them: each carries its own bubble,
                and a crown and a phoenix are two different things to have explained. Laid
                in a row so two sit side by side at the size one does. */}
              <TitleMark marks={marks} mine={isMine} size={MARK_SIZE} />
              {/* The same two averages the stat row below prints, handed to the name so
                the colour and the numbers explaining it can never disagree. */}
              {profile !== null && (
                <ProfileName
                  nickname={profile.nickname}
                  avgAccuracy={avgAccuracy}
                  avgSpeed={avgSpeed}
                  // Yours to rewrite, and the pencil is the only way to — a nickname used
                  // to be claimed once, at the end of the first run that scored, and
                  // never again. Left off a stranger's card, which is the whole of what
                  // `isMine` decides here.
                  onEdit={
                    isMine
                      ? () => {
                          setEditingName(true)
                        }
                      : undefined
                  }
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
              {profile !== null && (
                <ProfileTenure
                  joinedMonths={joinedMonths}
                  lastRunDays={lastRunDays}
                  lastRunDay={lastRunDay}
                />
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

                  <ProfileStatCells
                    lifetime={lifetime}
                    avgAccuracy={avgAccuracy}
                    avgSpeed={avgSpeed}
                    shownAchievements={shownAchievements}
                  />

                  <ProfileBoards rows={rows} />

                  {/* Omitted rather than shown empty: a heading over nothing reads as
                    something the player lost, which is exactly what it is not. */}
                  {isNonEmptyArray(profile.reigns) && (
                    <ProfileReigns reigns={profile.reigns} />
                  )}

                  {/* The challenges' podiums, under the boards' reigns: the other half of
                    what a player has taken, from the standings that close for good rather
                    than the ones that keep moving. Omitted when empty, for the reason the
                    list above is. */}
                  {isNonEmptyArray(profile.places) && (
                    <CardSection label={t`CHALLENGES`}>
                      {profile.places.map((place) => (
                        <ProfilePlaceRow key={place.sessionId} place={place} />
                      ))}
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
            </View>
          </ScrollView>

          {/* The address, in the slot the compare link holds on a stranger's card — the
              two never show together, so the foot of the card says the one thing there is
              to do with the profile you are looking at. See `ProfileEmail` for why it is
              down here rather than up with the name it used to sit under. */}
          {isMine && (
            <ProfileEmail
              email={email}
              pendingEmail={pendingEmail}
              onOpenEmail={onOpenEmail}
              onEnterCode={onEnterCode}
            />
          )}

          {/* Over the card's own CLOSE, outside the scroll and so pinned to the foot of
              the card with it. Everything above is the career, which is as long as the
              player has made it; this is what you might do when you have finished
              reading, and a control that has to be scrolled back down to is a control the
              player goes looking for.

              A link rather than a card row, and above the filled button rather than
              below: the intro's own arrangement, where the one thing the screen asks for
              is a button and everything else is a dim word with an icon beside it. Closing
              is what you do here, comparing is what you might, and the spelling says which
              is which.

              Only on someone else's card, and only once the viewer is known — a table of
              a player against themselves has a winner on no row and nothing to say.

              `mt-3` picks up the scroll's own rhythm, since the column inside it carries no
              bottom margin of its own — and it is on the link rather than on a wrapper
              around it, so your own card, which has nothing to compare against, does not
              hold the air where the link would have been. */}
          {profile !== null && !isMine && onCompare !== undefined && (
            <View className="mt-3 flex-row items-center justify-center">
              <TrackedPressable
                id="profile.action"
                hitSlop={10}
                onPress={() => {
                  // The table takes this profile's place rather than opening over it: the
                  // two say the same things about the same player, and stacking one on the
                  // other left the player two cards deep to get back out of. Asked for
                  // before `close`, so the comparison is already fading up as this card
                  // fades out — the cross-fade a screen change makes, in a dialog.
                  onCompare(userId, profile)
                  close()
                }}
              >
                <View className="flex-row items-center gap-1">
                  <Ionicons name="git-compare-outline" size={11} color={DIM_INK} />
                  <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                    <Trans>COMPARE WITH ME</Trans>
                  </Text>
                </View>
              </TrackedPressable>
            </View>
          )}

          {editingMotto && profile !== null && (
            <MottoModal
              motto={profile.motto}
              onSave={async (next) => {
                const res = await saveMotto(userId, next)
                if (res.error === null) {
                  // Applied to what is already on screen rather than refetched: the write
                  // has landed, and the profile behind this modal differs from the one
                  // already drawn by exactly this line.
                  patch({ motto: next })
                  setEditingMotto(false)
                }
                return res
              }}
              onCancel={() => {
                setEditingMotto(false)
              }}
            />
          )}

          {/* The name, in the same card that claims one after a first run — not a second
              dialog that happens to ask for a nickname. It arrives seeded with the name
              already held, which is the whole of what tells it it is a rename, and its own
              platform window is what gets the keyboard somewhere to lift from. */}
          {editingName && profile !== null && (
            <CardModal
              visible
              onRequestClose={() => {
                setEditingName(false)
              }}
            >
              <NicknameModal
                current={profile.nickname ?? ''}
                onSave={async (name) => {
                  const res = await onRename(name)
                  if (res.error === null) {
                    // The row behind this card differs from the one already drawn by
                    // exactly this name, so it is written rather than read again.
                    patch({ nickname: name })
                    setEditingName(false)
                  }
                  return res
                }}
                onDismiss={() => {
                  setEditingName(false)
                }}
              />
            </CardModal>
          )}
        </>
      )}
    </ModalCard>
  )
}

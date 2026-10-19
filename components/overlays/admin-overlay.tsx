import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'

import { AdminAccess } from '@/components/overlays/admin-access'
import { AdminMessages } from '@/components/overlays/admin-messages'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSessions } from '@/components/overlays/admin-sessions'
import { AdminStats } from '@/components/overlays/admin-stats'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { LiveDot } from '@/components/overlays/live-dot'
import { UnreadDot } from '@/components/overlays/unread-dot'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { useFeedbackOwed } from '@/hooks/use-feedback-owed'
import { listFeatures } from '@/lib/admin/features'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { loadStats } from '@/lib/admin/stats'
import { spanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import { labelOf, modeById } from '@/modes'

// The admin door, which is a crossroads rather than a screen.
//
// Four things are administered and no two of them have much to do with each other:
// **who sees what** — people, roles, features — **when a challenge is on**, **how the app
// is doing**, and **what players have written in**. All four sit behind the one `admin`
// feature, which is the key the link on the intro already asks for and the one the
// database refuses to let anybody switch off.
//
// A grid rather than a tab row. PEOPLE / ROLES / FEATURES are three views of one question
// and a tab row is how a reader is told that; the other three are different questions
// entirely, and hanging any of them off the same row would have said it was another way
// of looking at a person.
//
// **Each tile says what is behind it rather than what it is called.** A hub of four words
// is a menu you read once and then press from memory; a hub that says *one session is on
// and shuts in three hours* and *two messages are owed an answer* is worth opening on its
// own. That is three reads on mount, all small, all for the handful of people who hold
// this key — and the alternative is four screens somebody has to go into to find out
// whether there was anything in them.
//
// This file keeps its name and its export so `app/(tabs)/index.tsx` is untouched: what
// opens ADMIN has no business knowing the screen behind it grew a fork.
type Section = 'hub' | 'access' | 'sessions' | 'stats' | 'messages'

const TITLE = msg`ADMIN`

// What the four tiles say under their name, once the reads have landed. Null is still
// waiting — drawn as nothing rather than as a spinner per tile, which would be four
// things blinking on a screen whose figures arrive in well under a second.
type Notes = {
  features: ReactNode
  sessions: ReactNode
  stats: ReactNode
}

// One tile of the hub: a square, a name, and what is behind it.
//
// Square and two to a row, which is the shape that fits four doors on a phone without
// scrolling and gives each of them room for two lines of figures. A column of wide rows
// fitted three and pushed the fourth under the fold — and a hub you have to scroll is a
// hub that has stopped being a map.
//
// **No colour on it.** Each tile wore a bar of its section's own hue down the leading
// edge for a while. Four squares on one card stock with four words on them do not need
// telling apart by colour — the words do that, and at this size they are read from across
// the room — and the bar was the only thing on these screens asking a reader to learn a
// key. What the room it gave back went to is the type: the name is the primary button's
// own role and the figures under it are a size nobody has to lean in for, which is the
// whole point of a tile that reports rather than merely opens.
function Tile({
  label,
  note,
  dot = false,
  onPress,
}: {
  label: ReactNode
  note: ReactNode
  // There is something behind this that nobody has looked at.
  dot?: boolean
  onPress: () => void
}) {
  return (
    <TrackedPressable
      id="admin.section"
      onPress={onPress}
      // `aspect-square` rather than a height: the tiles are half the screen wide less the
      // gap, and a fixed height would be wrong on every display but the one it was typed
      // on.
      className="relative aspect-square flex-1 justify-between rounded-2xl bg-card p-3"
    >
      <View className="flex-row items-start justify-between">
        {/* `cardTitleSm` — the role for a card title where the card is a row rather than
            the whole screen, which is exactly what a tile is, and the largest role that
            fits. The ceiling is set by one word on one phone: CHALLENGES is ten
            characters, and a tile on a 320px display is 115px wide inside its padding, so
            14px at 1.5 tracking comes to about 99px and the 17px `cardTitle` to about
            122 — a wrapped CHALLEN/GES on the narrowest phone the app runs on. */}
        <Text selectable={false} className={cn(TYPE.cardTitleSm, 'text-primary')}>
          {label}
        </Text>
        {dot && <UnreadDot />}
      </View>
      <View>{note}</View>
    </TrackedPressable>
  )
}

// A tile's second line, in the one role the four of them share.
//
// `prose` rather than a label or a hint role, and it is the right one for what these
// lines actually are: sentences with figures in them, two lines long, which is what prose
// carries a leading for. The label roles are for naming a figure beside it — they go
// small because something else on the row is the content. Here the line *is* the content:
// it is the reason to open the tile, or the reason not to.
function Note({ children }: { children: ReactNode }) {
  return (
    <Text selectable={false} numberOfLines={2} className={cn(TYPE.prose, 'text-dim')}>
      {children}
    </Text>
  )
}

export function AdminOverlay({
  viewerId,
  onPreview,
  onClose,
}: {
  // Who is reading, handed through to the people list so it can say which row is theirs.
  viewerId: string | null
  // Wear a role and go and look, handed through to the ROLES tab. Starting one takes this
  // screen down — the caller does both, because the set a preview installs is the one the
  // link back here is drawn from.
  onPreview: (role: string | null, label: string | null) => void
  onClose: () => void
}) {
  const { t } = useLingui()
  const [section, setSection] = useState<Section>('hub')
  // Bumped when the messages screen writes, so the dot beside MESSAGES — and the figure
  // under it — answer for what the pile holds now rather than for what it held when this
  // overlay opened.
  const [messagesEpoch, setMessagesEpoch] = useState(0)
  const owed = useFeedbackOwed(messagesEpoch)
  const [notes, setNotes] = useState<Notes>({
    features: null,
    sessions: null,
    stats: null,
  })
  // The live session, held apart from the rest: its tile carries a clock, and a clock is
  // a component rather than a line of text — see `ChallengeCountdown`, which ticks
  // without waking the screen around it.
  const [live, setLive] = useState<AdminSession | null>(null)

  // Read on the way in, and again every time a section is finished with: the figures on
  // these tiles are the figures the sections behind them have just changed, and a hub
  // that still said *2 planned* after a session was booked would be the one screen in
  // this redesign that lied.
  //
  // Three calls at once rather than in sequence: they answer three different tiles and
  // none of them needs the others.
  useEffect(() => {
    if (section !== 'hub') return
    void (async () => {
      const openedAt = Date.now()
      const [features, sessions, stats] = await Promise.all([
        listFeatures(),
        listSessions(),
        loadStats('today'),
      ])

      const counted = { public: 0, private: 0, hidden: 0 }
      for (const row of features.rows) counted[row.visibility] += 1

      const running = sessions.rows.find(
        (session) => spanStatus(session, openedAt) === 'live',
      )
      const planned = sessions.rows.filter(
        (session) => spanStatus(session, openedAt) === 'upcoming',
      ).length

      setLive(running ?? null)
      setNotes({
        features: (
          <Note>
            {counted.public} <Trans>public</Trans> · {counted.private}{' '}
            <Trans>private</Trans> · {counted.hidden} <Trans>hidden</Trans>
          </Note>
        ),
        // Two shapes of the same line, decided here rather than in the tile: with a
        // session on, the clock above it has already said what is happening and this is
        // only what is booked behind it; with nothing on, that *is* the news and the line
        // says both halves.
        sessions:
          running === undefined ? (
            <Note>
              <Trans>Nothing on now</Trans> · {planned} <Trans>planned</Trans>
            </Note>
          ) : (
            <Note>
              {planned} <Trans>planned</Trans>
            </Note>
          ),
        stats:
          stats.stats === null ? null : (
            <Note>
              {stats.stats.runs.runs} <Trans>runs</Trans> · {stats.stats.runs.players}{' '}
              <Trans>played</Trans> · {stats.stats.players.joined} <Trans>joined</Trans>
            </Note>
          ),
      })
    })()
  }, [section])

  const toHub = () => {
    setSection('hub')
  }

  if (section === 'access') {
    return <AdminAccess viewerId={viewerId} onPreview={onPreview} onBack={toHub} />
  }
  if (section === 'sessions') return <AdminSessions onBack={toHub} />
  if (section === 'stats') return <AdminStats messagesOwed={owed} onBack={toHub} />
  if (section === 'messages') {
    return (
      <AdminMessages
        onChanged={() => {
          setMessagesEpoch((n) => n + 1)
        }}
        onBack={toHub}
      />
    )
  }

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton id="admin.done" onPress={onClose} label={<Trans>DONE</Trans>} />
      }
    >
      <View className="gap-2.5">
        <View className="flex-row gap-2.5">
          <Tile
            label={<Trans>FEATURES</Trans>}
            note={notes.features}
            onPress={() => {
              setSection('access')
            }}
          />
          <Tile
            label={<Trans>CHALLENGES</Trans>}
            note={
              // What is on now, and what is booked. The clock is the point of this tile:
              // a session's window is the one thing on these screens that runs out while
              // nobody is looking at it.
              live === null ? (
                notes.sessions
              ) : (
                <View>
                  {/* The breathing red dot the sessions list puts beside LIVE, here
                      ahead of the name for the same reason: this tile is the only one
                      on the hub reporting something that is *happening* rather than
                      counted, and the clock under it says how long for but not that it
                      is running. Drawn unconditionally because this branch is the live
                      one — `live` is the session `spanStatus` answered `live` for, and
                      a tile with nothing on shows the planned count instead.

                      `flex-1` on the name so it is the part that truncates: the tile is
                      half a phone wide, and without it a long challenge name pushes the
                      dot off its own row. */}
                  <View className="flex-row items-center gap-1.5">
                    <LiveDot />
                    <Text
                      selectable={false}
                      numberOfLines={1}
                      className={cn(TYPE.cardTitleSm, 'flex-1 text-primary')}
                    >
                      {modeById(live.modeId) === null
                        ? live.modeId
                        : t(labelOf(live.modeId))}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <ChallengeCountdown until={live.closesAt} className="text-dim" />
                    <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
                      <Trans>left</Trans>
                    </Text>
                  </View>
                  {notes.sessions}
                </View>
              )
            }
            onPress={() => {
              setSection('sessions')
            }}
          />
        </View>
        <View className="flex-row gap-2.5">
          <Tile
            label={<Trans>ANALYTICS</Trans>}
            note={notes.stats}
            onPress={() => {
              setSection('stats')
            }}
          />
          <Tile
            label={<Trans>MESSAGES</Trans>}
            dot={owed > 0}
            note={
              <Note>
                {owed === 0 ? (
                  <Trans>All answered</Trans>
                ) : (
                  <Trans>{owed} owed an answer</Trans>
                )}
              </Note>
            }
            onPress={() => {
              setSection('messages')
            }}
          />
        </View>
      </View>
    </AdminScreen>
  )
}

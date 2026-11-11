import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AdminAccess } from '@/components/overlays/admin-access'
import { AdminChallenges } from '@/components/overlays/admin-challenges'
import { AdminKnowledge } from '@/components/overlays/admin-knowledge'
import { AdminMessages } from '@/components/overlays/admin-messages'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminStats } from '@/components/overlays/admin-stats'
import { Note, Tile, TileGrid } from '@/components/overlays/admin-tile'
import { ChallengeCountdown } from '@/components/overlays/challenge-countdown'
import { LiveDot } from '@/components/overlays/live-dot'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { useFeedbackOwed } from '@/hooks/use-feedback-owed'
import { listFeatures } from '@/lib/admin/features'
import { listSessions, type AdminSession } from '@/lib/admin/sessions'
import { loadStats } from '@/lib/admin/stats'
import { spanStatus } from '@/lib/challenge-session'
import { cn } from '@/lib/cn'
import type { OpenSession } from '@/lib/session-board'
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
//
// CHALLENGES holds what were two tiles, the planner and the lab, as two tabs — see
// `AdminChallenges`. PLAY on a challenge's page is handed up as `onOpenChallenge`, since
// the dialog that deals the run lives at the app root.
type Section = 'hub' | 'access' | 'challenges' | 'stats' | 'messages' | 'knowledge'

const TITLE = msg`ADMIN`

// What the four tiles say under their name, once the reads have landed. Null is still
// waiting — drawn as nothing rather than as a spinner per tile, which would be four
// things blinking on a screen whose figures arrive in well under a second.
type Notes = {
  features: ReactNode
  sessions: ReactNode
  stats: ReactNode
}

export function AdminOverlay({
  viewerId,
  onPreview,
  onOpenChallenge,
  onClose,
}: {
  // Who is reading, handed through to the people list so it can say which row is theirs.
  viewerId: string | null
  // Wear a role and go and look, handed through to the ROLES tab. Starting one takes this
  // screen down — the caller does both, because the set a preview installs is the one the
  // link back here is drawn from.
  onPreview: (role: string | null, label: string | null) => void
  // PLAY on a challenge's page. Up to the app root, which owns the dialog that deals the
  // run; this screen stays where it was under it.
  onOpenChallenge: (modeId: string, session: OpenSession | null) => void
  onClose: () => void
}) {
  const { t } = useLingui()
  const [section, setSection] = useState<Section>('hub')
  // Bumped when the messages screen writes, so the badge on MESSAGES — and the figure
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
          <Note
            lines={[
              <>
                {counted.public} <Trans>public</Trans>
              </>,
              <>
                {counted.private} <Trans>private</Trans>
              </>,
              <>
                {counted.hidden} <Trans>hidden</Trans>
              </>,
            ]}
          />
        ),
        // Two shapes of the same line, decided here rather than in the tile: with a
        // session on, the clock above it has already said what is happening and this is
        // only what is booked behind it; with nothing on, that *is* the news and the line
        // says both halves.
        sessions:
          running === undefined ? (
            <Note
              lines={[
                <Trans key="now">Nothing on now</Trans>,
                <>
                  {planned} <Trans>planned</Trans>
                </>,
              ]}
            />
          ) : (
            <Note
              lines={[
                <>
                  {planned} <Trans>planned</Trans>
                </>,
              ]}
            />
          ),
        stats:
          stats.stats === null ? null : (
            <Note
              lines={[
                <>
                  {stats.stats.runs.runs} <Trans>runs</Trans>
                </>,
                <>
                  {stats.stats.runs.players} <Trans>played</Trans>
                </>,
                <>
                  {stats.stats.players.joined} <Trans>joined</Trans>
                </>,
              ]}
            />
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
  if (section === 'challenges') {
    return <AdminChallenges onOpenChallenge={onOpenChallenge} onBack={toHub} />
  }
  if (section === 'stats') return <AdminStats messagesOwed={owed} onBack={toHub} />
  if (section === 'knowledge') return <AdminKnowledge onBack={toHub} />
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
      {/* Five doors in three rows, and so a scroller: on the smallest phones the third
          row sits under the fold, which is the price of every door being a square with
          room for its figures. */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <TileGrid
          tiles={[
            <Tile
              key="features"
              icon="toggle-outline"
              label={<Trans>FEATURES</Trans>}
              note={notes.features}
              onPress={() => {
                setSection('access')
              }}
            />,
            <Tile
              key="stats"
              icon="stats-chart-outline"
              label={<Trans>ANALYTICS</Trans>}
              note={notes.stats}
              onPress={() => {
                setSection('stats')
              }}
            />,
            <Tile
              key="challenges"
              icon="trophy-outline"
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
                      <ChallengeCountdown
                        until={live.closesAt}
                        className="text-dim"
                        closing
                      />
                      <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
                        <Trans>left</Trans>
                      </Text>
                    </View>
                    {notes.sessions}
                  </View>
                )
              }
              onPress={() => {
                setSection('challenges')
              }}
            />,
            <Tile
              key="messages"
              icon="chatbubbles-outline"
              label={<Trans>MESSAGES</Trans>}
              unread={owed}
              note={
                <Note
                  lines={[
                    owed === 0 ? (
                      <Trans key="all">All answered</Trans>
                    ) : (
                      <Trans key="owed">{owed} owed an answer</Trans>
                    ),
                  ]}
                />
              }
              onPress={() => {
                setSection('messages')
              }}
            />,
            <Tile
              key="knowledge"
              icon="book-outline"
              label={<Trans>KNOWLEDGE</Trans>}
              note={
                <Note
                  lines={[
                    <Trans key="fortune">Fortune</Trans>,
                    <Trans key="secrets">Secrets</Trans>,
                    <Trans key="mechanics">Mechanics</Trans>,
                  ]}
                />
              }
              onPress={() => {
                setSection('knowledge')
              }}
            />,
          ]}
        />
      </ScrollView>
    </AdminScreen>
  )
}

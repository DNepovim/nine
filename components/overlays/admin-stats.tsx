import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'

import { DayBars, MeterRow, StatTile } from '@/components/overlays/admin-chart'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import { AdminStatPeople } from '@/components/overlays/admin-stat-people'
import { AdminChip, AdminTable } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { ARCADE_INK, DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { type StatTileKey } from '@/lib/admin/stat-people'
import { loadStats, type AdminStats } from '@/lib/admin/stats'
import { cn } from '@/lib/cn'
import { formatShortDay } from '@/lib/format-date'
import { POSTHOG_PROJECT_URL } from '@/lib/posthog-project'
import { type StatsWindow } from '@/lib/stats-window'
import {
  DIFFICULTIES,
  getDifficultyColor,
  isModeId,
  labelOf,
  type Difficulty,
} from '@/modes'

// How the app is doing: the third door off the admin hub, and the only one that reads
// without writing anything.
//
// Everything here was already in the database and nothing was asking it. The screen is
// one call — see `admin_stats` — drawn as four blocks, in the order somebody actually
// wants them: what this window came to, how the fortnight went, which boards it was
// played on, and what each challenge drew.
//
// **No figure on this screen names anybody.** That is a property of the function behind
// it rather than a choice made here: it returns counts, sums and groups and has no shape
// that could return a profile. The one way to a name is pressing a top tile, which opens
// the players behind it from a second function read only then — see `AdminStatPeople`.
const TITLE = msg`ANALYTICS`

// The six top tiles' labels, read by the tile and by the list it opens, so the card is
// always headed by the word that was pressed.
const TILE_LABEL: Record<StatTileKey, MessageDescriptor> = {
  joined: msg`JOINED`,
  played: msg`PLAYED`,
  runs: msg`RUNS`,
  minutes: msg`MINUTES`,
  hits: msg`HITS`,
  named: msg`NAMED`,
}

// Not translated, as the tab and status words on these screens are not: they name a
// window on a screen whose readers are the people who write the catalog.
const WINDOW_LABEL: Record<StatsWindow, string> = {
  today: 'TODAY',
  yesterday: 'YESTERDAY',
  // Short, because four of these share a row of segments the width of a phone. THIS
  // WEEK and LAST 30 DAYS did not fit a quarter of it.
  week: 'WEEK',
  month: '30 DAYS',
}

const WINDOWS: readonly StatsWindow[] = ['today', 'yesterday', 'week', 'month']

// The two words the figures need in the middle of a line rather than as a label of their
// own: what the window before came to, and how many messages are still owed an answer.
const WAS = msg`was`
const OWED = msg`OWED`

// The arrow that says which way a figure moved against the window before it. A glyph and
// not a colour: the direction has to be legible on its own — and *fewer runs than last
// week* is information rather than an alarm, which is what a red figure would make it.
const arrow = (now: number, before: number): string =>
  now === before ? '·' : now > before ? '▲' : '▼'

// The whole of a tile's second line: which way it moved, and what it moved from. Takes
// the word already translated, because a pure helper has no access to the catalog.
const against = (now: number, before: number, was: string): string =>
  `${arrow(now, before)} ${was} ${String(before)}`

// The rung a receipt was played on, narrowed. `run_receipts.difficulty` is a column with
// a check constraint on it rather than an enum this build owns, and the group-by coalesces
// a null to 'unknown' — so the one honest thing to do with a value none of the three names
// is to print it and colour it dim.
const rungOf = (value: string): Difficulty | null =>
  value === 'easy' || value === 'hard' || value === 'extreme' ? value : null

export function AdminStats({
  // How many messages are owed an answer, handed down from the hub rather than read
  // again here. The hub already asks `admin_feedback_owed` to decide whether to draw its
  // dot, and that function is the app's one definition of owed — it is the only one that
  // knows a message can be set aside. `admin_stats` used to answer this too, counting
  // every unanswered message; that key is gone rather than left to be read by mistake.
  messagesOwed,
  onBack,
}: {
  messagesOwed: number
  onBack: () => void
}) {
  const { t } = useLingui()
  const was = t(WAS)
  const owed = t(OWED)
  const [window, setWindow] = useState<StatsWindow>('today')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The tile whose players are open. One at a time.
  const [opened, setOpened] = useState<StatTileKey | null>(null)
  // Each top tile opens the players its figure is made of.
  const open = (tile: StatTileKey) => () => {
    setOpened(tile)
  }

  // Read again whenever the window moves. The figures are kept while the next window is
  // fetched rather than blanked — the three windows are three answers to the same
  // question, and a screen that emptied between them would read as the data going away.
  useEffect(() => {
    void (async () => {
      const res = await loadStats(window)
      if (res.stats !== null) setStats(res.stats)
      setError(res.error)
      setLoading(false)
    })()
  }, [window])

  const peak =
    stats === null ? 0 : stats.series.reduce((high, day) => Math.max(high, day.runs), 0)
  const mostPlayed =
    stats === null
      ? 0
      : stats.boards.reduce((high, board) => Math.max(high, board.runs), 0)

  return (
    <AdminScreen
      error={error}
      title={t(TITLE)}
      footer={
        <View className="gap-2">
          <PrimaryButton
            id="admin.open_posthog"
            tone="quiet"
            onPress={() => {
              void Linking.openURL(POSTHOG_PROJECT_URL)
            }}
            label={<Trans>OPEN IN POSTHOG</Trans>}
          />
          <PrimaryButton id="admin.back" onPress={onBack} label={<Trans>BACK</Trans>} />
        </View>
      }
    >
      {/* The same row of segments every other admin list sorts by. It was a combobox
          for a while, on the reasoning that the window is a setting read once rather than
          the screen's subject — but it is the one thing on this screen anybody changes,
          and a combobox put that change two presses away and looked like no other
          control on these screens. Opens on TODAY: the figure the admin opens the app on
          a phone to check. */}
      <AdminSegments
        id="admin.filter"
        className="mb-2.5"
        value={window}
        onSelect={setWindow}
        options={WINDOWS.map((option) => ({
          value: option,
          label: WINDOW_LABEL[option],
        }))}
      />

      {stats === null ? (
        <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
          {loading ? (
            <Trans>Reading…</Trans>
          ) : (
            // The one failure worth its own sentence: the migration behind this screen is
            // not applied until somebody pushes it, and `admin_stats: not an admin` is
            // the other thing it can say. Both arrive as the error line above; this is
            // what stands where the figures would be.
            <Trans>No figures. See the error above.</Trans>
          )}
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── What the window came to ──
              Six tiles, and the three on the first row are the three that matter: who
              arrived, who played, and how much. */}
          <View className="mb-1.5 flex-row gap-1.5">
            <StatTile
              label={t(TILE_LABEL.joined)}
              onPress={open('joined')}
              value={String(stats.players.joined)}
              note={against(stats.players.joined, stats.players.joinedBefore, was)}
            />
            <StatTile
              label={t(TILE_LABEL.played)}
              onPress={open('played')}
              value={String(stats.runs.players)}
              note={<Trans>profiles</Trans>}
            />
            <StatTile
              label={t(TILE_LABEL.runs)}
              onPress={open('runs')}
              value={String(stats.runs.runs)}
              note={against(stats.runs.runs, stats.runs.before, was)}
            />
          </View>
          <View className="mb-3 flex-row gap-1.5">
            <StatTile
              label={t(TILE_LABEL.minutes)}
              onPress={open('minutes')}
              value={String(stats.runs.minutes)}
              note={<Trans>on the dial</Trans>}
            />
            <StatTile
              label={t(TILE_LABEL.hits)}
              onPress={open('hits')}
              value={String(stats.runs.hits)}
              note={<Trans>targets met</Trans>}
            />
            <StatTile
              label={t(TILE_LABEL.named)}
              onPress={open('named')}
              value={String(stats.players.joinedNamed)}
              note={<Trans>of the joined</Trans>}
            />
          </View>

          {/* ── The fortnight ──
              Always fourteen days, whatever window is selected: a bar a day is the one
              block here that says the same thing at every setting, and TODAY would
              otherwise draw a chart with one bar in it. */}
          <View className="mb-3 rounded-xl bg-card p-2.5">
            <View className="mb-2 flex-row items-end justify-between">
              <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
                <Trans>RUNS A DAY</Trans>
              </Text>
              <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                <Trans>peak</Trans> {peak}
              </Text>
            </View>
            <DayBars
              color={ARCADE_INK}
              days={stats.series.map((day) => ({ day: day.day, value: day.runs }))}
            />
            <View className="mt-1 flex-row justify-between">
              <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                {formatShortDay(stats.series[0]?.day ?? '')}
              </Text>
              {/* Why it stops at a fortnight and never grows: the receipts a run writes
                  are pruned after thirty days, so there is no older answer to draw. */}
              <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                {formatShortDay(stats.series[stats.series.length - 1]?.day ?? '')}
              </Text>
            </View>
          </View>

          {/* ── Which board ──
              Mode and rung together, because that pairing is what this app calls a board.
              Each bar wears that board's own colour — the hue says which mode and the
              shade says which rung, exactly as the selectors on the intro do — and the
              name on the bar is what actually identifies it. See `MeterRow`. */}
          <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
            <Trans>RUNS BY BOARD</Trans>
          </Text>
          <View className="mb-3 rounded-xl bg-card px-2.5 pb-1 pt-2.5">
            {stats.boards.length === 0 ? (
              <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-dim')}>
                <Trans>No runs in this window.</Trans>
              </Text>
            ) : (
              stats.boards.map((board) => {
                const rung = rungOf(board.difficulty)
                const known = isModeId(board.mode) && rung !== null
                return (
                  <MeterRow
                    key={`${board.mode}-${board.difficulty}`}
                    label={`${isModeId(board.mode) ? t(labelOf(board.mode)) : board.mode} · ${
                      rung === null ? board.difficulty : t(DIFFICULTIES[rung].label)
                    }`}
                    // Runs, then the players who played them. Two figures because one
                    // player having a long evening and twenty players having a go are the
                    // same bar otherwise.
                    value={`${board.runs} · ${board.players}`}
                    share={mostPlayed === 0 ? 0 : board.runs / mostPlayed}
                    // A board this build cannot name has no colour to wear either — it is
                    // a row the server holds and the code does not, the same case the
                    // sessions list draws in red. Dim, rather than a hue borrowed from a
                    // mode it is not.
                    color={known ? getDifficultyColor(board.mode, rung) : DIM_INK}
                  />
                )
              })
            )}
          </View>

          {/* ── The challenges that ran ──
              The five most recent sessions whatever the window, because a session is its
              own window: filtering these by the one on screen would hide the thing
              somebody opened this block to see. */}
          <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
            <Trans>LAST FIVE SESSIONS</Trans>
          </Text>
          <AdminTable
            className="mb-3"
            columns={[
              { label: 'CHALLENGE', tone: 'name' },
              { label: 'PLAYERS', width: 56, align: 'right', tone: 'figure' },
              { label: 'BEST', width: 56, align: 'right', tone: 'figure' },
            ]}
            rows={stats.sessions.map((session) => ({
              key: session.id,
              cells: [
                isModeId(session.modeId) ? t(labelOf(session.modeId)) : session.modeId,
                String(session.players),
                session.best === null ? '—' : String(session.best),
              ],
            }))}
            empty={<Trans>No sessions have been planned.</Trans>}
          />

          {/* ── Everything else worth one figure ──
              Four counts over the window and one that is not: the messages still owed an
              answer, which is a thing to go and do rather than a thing that happened. */}
          <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
            <Trans>ALSO IN THIS WINDOW</Trans>
          </Text>
          <AdminTable
            columns={[{ tone: 'name' }, { width: 96, align: 'right', tone: 'figure' }]}
            rows={[
              {
                key: 'feedback',
                cells: [
                  t(msg`Messages sent in`),
                  messagesOwed > 0 ? (
                    <View className="flex-row items-center gap-2">
                      <AdminChip label={`${messagesOwed} ${owed}`} tone="danger" />
                      <Text
                        selectable={false}
                        className={cn(TYPE.figure, 'text-primary')}
                      >
                        {stats.pulse.feedback}
                      </Text>
                    </View>
                  ) : (
                    String(stats.pulse.feedback)
                  ),
                ],
              },
              {
                key: 'achievements',
                cells: [t(msg`Achievements unlocked`), String(stats.pulse.achievements)],
              },
              {
                key: 'rooms',
                cells: [t(msg`Rooms created`), String(stats.pulse.rooms)],
              },
              {
                key: 'reigns',
                cells: [t(msg`Boards taken over`), String(stats.pulse.reigns)],
              },
              // The two that are not about the window at all: the population itself.
              {
                key: 'profiles',
                cells: [t(msg`Profiles, all time`), String(stats.players.total)],
              },
              {
                key: 'named',
                cells: [
                  t(msg`Of them, named`),
                  `${stats.players.named} · ${
                    stats.players.total === 0
                      ? 0
                      : Math.round((100 * stats.players.named) / stats.players.total)
                  }%`,
                ],
              },
            ]}
          />
        </ScrollView>
      )}

      {opened !== null && (
        <AdminStatPeople
          tile={opened}
          title={t(TILE_LABEL[opened])}
          window={window}
          onDismiss={() => {
            setOpened(null)
          }}
        />
      )}
    </AdminScreen>
  )
}

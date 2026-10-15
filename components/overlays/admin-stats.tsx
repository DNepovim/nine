import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { DayBars, MeterRow, StatTile } from '@/components/overlays/admin-chart'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSelect } from '@/components/overlays/admin-select'
import { AdminChip, AdminTable } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { ARCADE_INK, DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { loadStats, type AdminStats } from '@/lib/admin/stats'
import { cn } from '@/lib/cn'
import { formatShortDay } from '@/lib/format-date'
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
// that could return a profile. A screen about how many people did something has no
// business saying which.
const TITLE = msg`ANALYTICS`

// Not translated, as the tab and status words on these screens are not: they name a
// window on a screen whose readers are the people who write the catalog.
const WINDOW_LABEL: Record<StatsWindow, string> = {
  today: 'TODAY',
  yesterday: 'YESTERDAY',
  week: 'THIS WEEK',
  month: 'LAST 30 DAYS',
}

// What each window is to be read as, in the one place there is room to say it: the open
// combobox. Today is always short and always rising; yesterday is the only setting here
// whose figure is final and whose comparison is like for like.
const WINDOW_NOTE: Record<StatsWindow, ReactNode> = {
  today: <Trans>Still running</Trans>,
  yesterday: <Trans>A finished day, against the day before</Trans>,
  week: <Trans>Since Monday, the week a player sees</Trans>,
  month: <Trans>As far back as the run receipts go</Trans>,
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

export function AdminStats({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  const was = t(WAS)
  const owed = t(OWED)
  const [window, setWindow] = useState<StatsWindow>('week')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <PrimaryButton id="admin.back" onPress={onBack} label={<Trans>BACK</Trans>} />
      }
    >
      {/* A combobox and not a row of four pills. The window is a *setting* on this screen
          rather than its subject — it is read once, changed rarely, and the figures under
          it are what anybody came for — and four pills wide enough to be pressed would
          have wrapped onto two lines above them. */}
      <AdminSelect
        title={<Trans>OVER WHAT WINDOW</Trans>}
        className="mb-2.5"
        value={window}
        onSelect={setWindow}
        options={WINDOWS.map((option) => ({
          value: option,
          label: WINDOW_LABEL[option],
          note: WINDOW_NOTE[option],
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
              label={<Trans>JOINED</Trans>}
              value={String(stats.players.joined)}
              note={against(stats.players.joined, stats.players.joinedBefore, was)}
            />
            <StatTile
              label={<Trans>PLAYED</Trans>}
              value={String(stats.runs.players)}
              note={<Trans>profiles</Trans>}
            />
            <StatTile
              label={<Trans>RUNS</Trans>}
              value={String(stats.runs.runs)}
              note={against(stats.runs.runs, stats.runs.before, was)}
            />
          </View>
          <View className="mb-3 flex-row gap-1.5">
            <StatTile
              label={<Trans>MINUTES</Trans>}
              value={String(stats.runs.minutes)}
              note={<Trans>on the dial</Trans>}
            />
            <StatTile
              label={<Trans>HITS</Trans>}
              value={String(stats.runs.hits)}
              note={<Trans>targets met</Trans>}
            />
            <StatTile
              label={<Trans>NAMED</Trans>}
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
              { label: 'PLAYERS', width: 56, align: 'right' },
              { label: 'BEST', width: 56, align: 'right' },
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
            columns={[{ tone: 'name' }, { width: 96, align: 'right' }]}
            rows={[
              {
                key: 'feedback',
                cells: [
                  t(msg`Messages sent in`),
                  stats.pulse.feedbackOwed > 0 ? (
                    <View className="flex-row items-center gap-2">
                      <AdminChip
                        label={`${stats.pulse.feedbackOwed} ${owed}`}
                        tone="danger"
                      />
                      <Text selectable={false} className={cn(TYPE.figure, 'text-dim')}>
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
    </AdminScreen>
  )
}

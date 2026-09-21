import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useFonts } from 'expo-font'
import { isEmptyArray, isNonEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { MedalLine } from '@/components/overlays/medal-line'
import { ModalCard } from '@/components/overlays/modal-card'
import { ProfileBoardRow } from '@/components/overlays/profile-board-row'
import { ProfileName } from '@/components/overlays/profile-name'
import { ProfileReignRow } from '@/components/overlays/profile-reign-row'
import { ProfileScore } from '@/components/overlays/profile-score'
import { StatCell } from '@/components/overlays/stat-cell'
import { mono } from '@/constants/theme'
import { useChampionsContext } from '@/hooks/use-champions'
import { usePlayerProfile } from '@/hooks/use-player-profile'
import { useViewport } from '@/hooks/use-viewport'
import { championMark } from '@/lib/champions'
import { formatReleaseDate } from '@/lib/format-date'
import { averagePercent, boardRows, lifetimeOf } from '@/lib/player-profile'
import { MODE_GRADIENT, MODES, SCORED_MODES, type ScoredMode } from '@/machines/game'

// The day the counters started. Every lifetime number below is counted from here, and a
// player who has been at this for a year would otherwise read as a newcomer — the app
// saying "3 runs" about someone with a year behind them is the app lying about them.
const COUNTING_SINCE = '2026-09-21'

// What each mode is judged on, as the column heading over its own average.
const AVERAGE_LABEL = {
  accuracy: msg`ACC`,
  speed: msg`SPD`,
} as const satisfies Record<ScoredMode, MessageDescriptor>

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
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const { t } = useLingui()
  const { height } = useViewport()
  const [dsegLoaded] = useFonts({ DSEG7: DSEG7Font })
  const digitFont = dsegLoaded ? 'DSEG7' : mono
  const { profile, loading, error, reload } = usePlayerProfile(userId)
  // Read from the context rather than fetched here: the two Extreme leaders are already
  // known and kept live off the board connection, and a second read would let this modal
  // contradict the row that opened it.
  const mark = championMark(userId, useChampionsContext())

  const lifetime = profile === null ? null : lifetimeOf(profile.totals)
  const rows = profile === null ? [] : boardRows(profile)
  // Both factors over every hit the player has landed, in either mode — the same pair
  // the game over screen shows for a single run.
  const avgAccuracy =
    lifetime === null ? null : averagePercent(lifetime.accSum, lifetime.hits)
  const avgSpeed =
    lifetime === null ? null : averagePercent(lifetime.spdSum, lifetime.hits)
  const percent = (value: number | null): string => (value === null ? '—' : `${value}%`)

  return (
    <ModalCard
      title={<Trans>PLAYER</Trans>}
      onDismiss={onClose}
      maxHeight={height * 0.85}
    >
      {() => (
        <>
          {/* The mark sits above the name, as it does on every row that wears one. */}
          {mark !== null && (
            <Text
              selectable={false}
              className="mb-1 text-center text-[30px] leading-[34px]"
            >
              {mark}
            </Text>
          )}
          {profile !== null && <ProfileName nickname={profile.nickname ?? '…'} />}
          {/* Under the name, the way the intro screen puts it under the title — same
                component, same one-per-mode reduction, so a player's medals read the
                same wherever they are drawn. */}
          {profile !== null && <MedalLine medals={profile.medals} />}

          {/* flexShrink lets a long profile scroll while a short one stays its own
                height — without it the ScrollView would claim the whole cap. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingVertical: 8 }}
          >
            {/* A profile nobody could read shows what went wrong and offers another
                  go. It never falls back to zeroes, which are indistinguishable from a
                  real player who has not played yet. */}
            {profile === null && error !== null && (
              <View className="items-center py-4">
                <Text
                  selectable={false}
                  className="mb-4 text-center font-mono text-[11px] text-dim"
                >
                  <Trans>This profile could not be loaded.</Trans>
                </Text>
                <Pressable
                  onPress={reload}
                  className="items-center rounded-2xl bg-card px-6 py-3"
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[11px] font-black tracking-[2px] text-primary"
                  >
                    <Trans>TRY AGAIN</Trans>
                  </Text>
                </Pressable>
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
                <ProfileScore score={lifetime.score} digitFont={digitFont} />
                <Text
                  selectable={false}
                  className="mb-4 mt-0.5 text-center font-mono text-[8px] font-bold tracking-[1px] text-dim"
                >
                  <Trans>SCORE</Trans>
                </Text>

                <View className="mb-5 w-full flex-row items-start justify-center gap-5">
                  <StatCell label={t`RUNS`} value={String(lifetime.runs)} />
                  <StatCell label={t`HITS`} value={String(lifetime.hits)} />
                  <StatCell label={t`AVG ACC`} value={percent(avgAccuracy)} />
                  <StatCell label={t`AVG SPD`} value={percent(avgSpeed)} />
                </View>

                <Text
                  selectable={false}
                  className="mb-5 text-center font-mono text-[8px] tracking-[0.5px] text-dim"
                >
                  <Trans>COUNTING SINCE {formatReleaseDate(COUNTING_SINCE)}</Trans>
                </Text>

                {SCORED_MODES.map((mode) => (
                  <Fragment key={mode}>
                    <View className="mt-1 h-7 flex-row items-end">
                      <Text
                        selectable={false}
                        className="flex-1 font-mono text-[11px] font-black tracking-[2px]"
                        style={{ color: MODE_GRADIENT[mode][0] }}
                      >
                        {t(MODES[mode].label)}
                      </Text>
                      <Text
                        selectable={false}
                        className="w-14 text-right font-mono text-[8px] font-bold tracking-[1px] text-dim"
                      >
                        <Trans>RUNS</Trans>
                      </Text>
                      <Text
                        selectable={false}
                        className="w-20 text-right font-mono text-[8px] font-bold tracking-[1px] text-dim"
                      >
                        <Trans>BEST</Trans>
                      </Text>
                      <Text
                        selectable={false}
                        className="w-16 text-right font-mono text-[8px] font-bold tracking-[1px] text-dim"
                      >
                        {t(AVERAGE_LABEL[mode])}
                      </Text>
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
                        />
                      ))}
                  </Fragment>
                ))}

                {/* Omitted rather than shown empty: a heading over nothing reads as
                      something the player lost, which is exactly what it is not. */}
                {isNonEmptyArray(profile.reigns) && (
                  <>
                    <Text
                      selectable={false}
                      className="mb-1 mt-6 font-mono text-[9px] font-black tracking-[2px] text-dim"
                    >
                      <Trans>RECORDS HELD, EVER</Trans>
                    </Text>
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
                  </>
                )}

                {lifetime.runs === 0 && isEmptyArray(profile.bests) && (
                  <Text
                    selectable={false}
                    className="mt-6 text-center font-mono text-[10px] text-dim"
                  >
                    <Trans>No runs counted yet.</Trans>
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}
    </ModalCard>
  )
}

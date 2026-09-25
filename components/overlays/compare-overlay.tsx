import { Trans, useLingui } from '@lingui/react/macro'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { CompareBoardRow } from '@/components/overlays/compare-board-row'
import { CompareStatRow } from '@/components/overlays/compare-stat-row'
import { ModalCard } from '@/components/overlays/modal-card'
import { usePlayerProfile } from '@/hooks/use-player-profile'
import { useViewport } from '@/hooks/use-viewport'
import { compareProfiles } from '@/lib/compare'
import type { PlayerProfile } from '@/lib/player-profile'
import { MODE_GRADIENT, MODES } from '@/machines/game'

// The two careers side by side, opened from the bottom of a profile.
//
// It takes the profile it was opened over rather than fetching it again: the numbers in the
// right-hand column are the numbers on the card behind this one, and a second read is a
// second chance for the two to disagree. Only the viewer's own profile is fetched here —
// usually from the session cache the profile hook keeps, so the table is up before the
// card has finished arriving.
export function CompareOverlay({
  viewerId,
  theirProfile,
  onClose,
}: {
  // Who is looking. The left column, and the one profile this modal has to go and get.
  viewerId: string
  theirProfile: PlayerProfile
  onClose: () => void
}) {
  const { t } = useLingui()
  const { height } = useViewport()
  const { profile: myProfile, loading, error, reload } = usePlayerProfile(viewerId)

  const comparison = myProfile === null ? null : compareProfiles(myProfile, theirProfile)

  // `replacing`: this table only ever opens from the bottom of a profile card, and it
  // opens under that card. It is covered for the length of the profile's exit, so it is
  // there in full the moment that card clears rather than fading up through it.
  return (
    <ModalCard title={t`COMPARE`} onDismiss={onClose} maxHeight={height * 0.85} replacing>
      {(close) => (
        <View className="shrink gap-3">
          {/* Who is in which column, stated once at the top rather than left to the
              player to work out from the numbers. Both sit in the label ink: this is the
              table's header, and a column heading that competed with the figures under it
              would be the loudest thing on a screen whose whole point is the figures. */}
          <View className="h-7 flex-row items-end">
            <View className="flex-1" />
            <Text
              selectable={false}
              numberOfLines={1}
              className="w-[72px] text-right font-mono text-[8px] font-bold tracking-[1px] text-dim"
            >
              <Trans>YOU</Trans>
            </Text>
            <Text
              selectable={false}
              numberOfLines={1}
              className="w-[72px] text-right font-mono text-[8px] font-bold tracking-[1px] text-dim"
            >
              {theirProfile.nickname ?? '…'}
            </Text>
          </View>

          {/* The same shape the profile card uses: the scroll gives way inside the card's
              height cap while a short table stays its own height. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
          >
            <View className="gap-3">
              {/* A career that could not be read is never drawn as a career of zeroes —
                  the same call the profile makes, and for the same reason: a table that
                  quietly awards every row to the other player because one side failed to
                  load is worse than a table that says it failed. */}
              {myProfile === null && error !== null && (
                <View className="items-center gap-3 py-4">
                  <Text
                    selectable={false}
                    className="text-center font-mono text-[11px] text-dim"
                  >
                    <Trans>Your profile could not be loaded.</Trans>
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

              {myProfile === null && error === null && loading && (
                <Text
                  selectable={false}
                  className="py-6 text-center font-mono text-[11px] text-dim"
                >
                  <Trans>LOADING…</Trans>
                </Text>
              )}

              {comparison !== null && (
                <>
                  <View>
                    {comparison.lifetime.map((row) => (
                      <CompareStatRow
                        key={row.stat}
                        stat={row.stat}
                        mine={row.mine}
                        theirs={row.theirs}
                        leader={row.leader}
                      />
                    ))}
                  </View>

                  {/* What the six rows below are, said once. Without it the block is two
                      columns of numbers under a mode name, and a player could reasonably
                      read them as runs. */}
                  <View className="h-7 flex-row items-end">
                    <Text
                      selectable={false}
                      className="font-mono text-[9px] font-black tracking-[2px] text-dim"
                    >
                      <Trans>BEST ON EACH BOARD</Trans>
                    </Text>
                  </View>

                  {comparison.boards.map((block) => (
                    <View key={block.mode}>
                      <View className="h-7 flex-row items-end">
                        <Text
                          selectable={false}
                          className="flex-1 font-mono text-[11px] font-black tracking-[2px]"
                          style={{ color: MODE_GRADIENT[block.mode][0] }}
                        >
                          {t(MODES[block.mode].label)}
                        </Text>
                      </View>
                      {block.rows.map((row) => (
                        <CompareBoardRow
                          key={row.difficulty}
                          mode={block.mode}
                          difficulty={row.difficulty}
                          mine={row.mine}
                          theirs={row.theirs}
                          leader={row.leader}
                        />
                      ))}
                    </View>
                  ))}
                </>
              )}
            </View>
          </ScrollView>

          {/* The way out, at the end of the table as well as in the card's corner. A
              comparison is read top to bottom, and by the last board the 5-dot cross in
              the header has scrolled a thumb's length out of reach. */}
          <Pressable
            onPress={close}
            className="items-center rounded-2xl bg-strong py-3.5"
          >
            <Text
              selectable={false}
              className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
            >
              <Trans>CLOSE</Trans>
            </Text>
          </Pressable>
        </View>
      )}
    </ModalCard>
  )
}

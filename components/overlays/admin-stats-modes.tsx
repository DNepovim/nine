import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { MeterRow } from '@/components/overlays/admin-chart'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { rungOf } from '@/lib/admin/stat-figures'
import type { StatsBoard } from '@/lib/admin/stats'
import { cn } from '@/lib/cn'
import { DIFFICULTIES, isModeId, labelOf, meterInkOf } from '@/modes'

// The ANALYTICS screen's runs by mode: one bar per mode and rung played in the window.
export function AdminStatsModes({ boards }: { boards: readonly StatsBoard[] }) {
  const { t } = useLingui()
  const mostPlayed = boards.reduce((high, board) => Math.max(high, board.runs), 0)

  return (
    <>
      {/* ── Which mode ──
              Mode and rung together. For Accuracy and Speed that pairing is what this app
              calls a board; a challenge is not one — its runs belong to a session — which
              is why the heading says mode since challenge runs were counted here. Each bar
              wears its mode's own colour — the hue says which mode and the shade says
              which rung, exactly as the selectors on the intro do — and the name on the
              bar is what actually identifies it. See `MeterRow`. */}
      <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
        <Trans>RUNS BY MODE</Trans>
      </Text>
      <View className="mb-3 rounded-xl bg-card px-2.5 pb-1 pt-2.5">
        {boards.length === 0 ? (
          <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-dim')}>
            <Trans>No runs in this window.</Trans>
          </Text>
        ) : (
          boards.map((board) => {
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
                color={known ? meterInkOf(board.mode, rung) : DIM_INK}
              />
            )
          })
        )}
      </View>
    </>
  )
}

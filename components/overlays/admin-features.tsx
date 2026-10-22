import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { PROTECTED_FEATURE } from '@/components/overlays/admin-feature'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { VisibilityChip } from '@/components/overlays/admin-visibility-picker'
import { TYPE } from '@/constants/typography'
import { listFeatures, type AdminFeature } from '@/lib/admin/features'
import { cn } from '@/lib/cn'

// A fixed width, because the three labels are three lengths and a column that resized
// itself every time one row changed read as the list redrawing rather than as one switch
// moving.
const SWITCH_W = 76

// Every feature, as a list of doors. The switch and the note were edited in place here;
// both moved to the feature's own screen, where the roles and people it reaches are
// listed under them. What stays is what the list is scanned for: which ones are out how
// far, in a hue per position, and roughly how many people each reaches.
export function AdminFeatures({
  epoch,
  onOpenFeature,
}: {
  epoch: number
  onOpenFeature: (feature: AdminFeature) => void
}) {
  const [rows, setRows] = useState<AdminFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Only the first read has nothing to draw, so only the first read is allowed to blank
  // the list. `epoch` bumps after the feature screen's writes as well, and swapping the
  // rows for a spinner on each of those was the screen flashing on every visit.
  useEffect(() => {
    void (async () => {
      const res = await listFeatures()
      setRows(res.rows)
      setError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  const tableRows: readonly AdminTableRow[] = rows.map((row) => ({
    key: row.key,
    onPress: () => {
      onOpenFeature(row)
    },
    cells: [
      `${row.key}${row.key === PROTECTED_FEATURE ? ' 🔒' : ''}`,
      // Roles granting it, then people who actually reach it — the second counts
      // overrides in. A public feature has no such pair: it reaches a population that
      // grows with every player who opens the app, and the stack beside it has stopped
      // deciding anything.
      row.visibility === 'public' ? (
        <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
          <Trans>everyone</Trans>
        </Text>
      ) : (
        `${row.roleCount} · ${row.personCount}`
      ),
      <VisibilityChip visibility={row.visibility} className="w-full" />,
    ],
    note:
      row.inBuild && row.note === null ? undefined : (
        <View>
          {!row.inBuild && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-red-500')}>
              {/* A row the database holds and this build does not: a key left behind by
                  a migration, or a device older than the server. Shown rather than
                  hidden — unseen configuration is how it goes stale. */}
              ⚠ <Trans>not in this build</Trans>
            </Text>
          )}
          {row.note !== null && (
            <Text
              selectable={false}
              className={cn(TYPE.value, 'leading-[15px] text-dim')}
            >
              {row.note}
            </Text>
          )}
        </View>
      ),
  }))

  return (
    <View className="flex-1">
      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminTable
          rowId="admin.feature"
          loading={loading}
          columns={[
            { label: 'FEATURE', tone: 'name' },
            { label: 'ROLE · PPL', width: 62, align: 'right' },
            { width: SWITCH_W, align: 'right' },
          ]}
          rows={tableRows}
          empty={<Trans>No features in the database.</Trans>}
        />
      </ScrollView>
    </View>
  )
}

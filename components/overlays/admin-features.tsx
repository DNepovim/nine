import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { PROTECTED_FEATURE } from '@/components/overlays/admin-feature'
import { AdminTable, type AdminTableRow } from '@/components/overlays/admin-table'
import { VisibilityChip } from '@/components/overlays/admin-visibility-picker'
import { TYPE } from '@/constants/typography'
import { listFeatures, type AdminFeature } from '@/lib/admin/features'
import { cn } from '@/lib/cn'
import { featureLabel } from '@/lib/features'

// Every feature, as a list of doors. The switch and the note were edited in place here;
// both moved to the feature's own screen, where the roles and people it reaches are
// listed under them. What stays is what the list is scanned for: which ones are out how
// far, in a hue per position, and roughly how many people each reaches — under the name
// rather than in columns beside it, so the name has the row's whole width. The note is
// the feature screen's alone: a paragraph per row made the list a document to scroll.
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
    cells: [`${featureLabel(row.key)}${row.key === PROTECTED_FEATURE ? ' 🔒' : ''}`],
    note: (
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <VisibilityChip visibility={row.visibility} />
          {/* Roles granting it, then people who actually reach it — the second counts
              overrides in. A public feature has no such pair: it reaches a population
              that grows with every player who opens the app, and the stack beside it has
              stopped deciding anything. */}
          <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
            {row.visibility === 'public' ? (
              <Trans>everyone</Trans>
            ) : (
              // Label before figure, so one role and five people read without a
              // plural form to get wrong.
              <Trans>
                roles {row.roleCount} · people {row.personCount}
              </Trans>
            )}
          </Text>
        </View>
        {!row.inBuild && (
          <Text selectable={false} className={cn(TYPE.hint, 'text-red-500')}>
            {/* A row the database holds and this build does not: a key left behind by a
                migration, or a device older than the server. Shown rather than hidden —
                unseen configuration is how it goes stale. */}
            ⚠ <Trans>not in this build</Trans>
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
          columns={[{ label: 'FEATURE', tone: 'name' }]}
          rows={tableRows}
          empty={<Trans>No features in the database.</Trans>}
        />
      </ScrollView>
    </View>
  )
}

import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'

import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useFlag } from '@/hooks/use-flags'
import { createRole, listRoles, type AdminRole } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// A role key is what `profiles.role` stores, so it has to survive being typed into a
// phone: lower case, no spaces. The label is free.
const toKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function AdminRoles({
  epoch,
  onOpenRole,
  onPreview,
  onChanged,
}: {
  epoch: number
  onOpenRole: (role: AdminRole) => void
  // Wear this role and go and look. Takes the label as well as the key because the badge
  // that ends the preview prints it, and a `roles` row is the only place it exists —
  // fetching it again from under a screen that already has it would be asking the server
  // to repeat itself.
  onPreview: (role: string | null, label: string | null) => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  // The real answer, not a previewed one: a preview takes this screen down with it, so
  // the row below can never be asking about the set it just installed.
  const canPreview = useFlag('rolePreview')

  // Only the first read blanks the list — see the note on the same effect in
  // admin-people.tsx. A reload keeps the rows that are already on screen.
  useEffect(() => {
    void (async () => {
      const res = await listRoles()
      setRows(res.rows)
      setError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  const handleCreate = async () => {
    const label = draft.trim().toUpperCase()
    const key = toKey(draft)
    if (key === '') return
    setBusy(true)
    const res = await createRole(key, label)
    setBusy(false)
    setError(res.error)
    if (res.error === null) {
      setDraft('')
      onChanged()
    }
  }

  return (
    <View className="flex-1">
      <View className="mb-3 flex-row gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="new role"
          placeholderTextColor={DIM_INK}
          autoCapitalize="characters"
          autoCorrect={false}
          className="flex-1 rounded-lg border border-dim/30 bg-background px-3 py-2 font-mono font-bold tracking-[1px] text-primary"
        />
        <PrimaryButton
          id="admin.role_new"
          variant="compact"
          onPress={() => {
            void handleCreate()
          }}
          disabled={busy || draft.trim() === ''}
          label={<Trans>ADD</Trans>}
        />
      </View>

      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator className="my-4" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => (
            <TrackedPressable
              id="admin.role"
              onPress={() => {
                onOpenRole(item)
              }}
              className="flex-row items-center justify-between border-b border-dim/10 py-2.5"
            >
              <Text selectable={false} className={cn(TYPE.prose, 'flex-1 text-primary')}>
                {item.label}
              </Text>
              {/* Features in the stack, then people holding the role. The second is the
                  warning the detail screen repeats: editing a stack moves all of them. */}
              <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
                {item.featureCount} · {item.personCount}
              </Text>
            </TrackedPressable>
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Wearing one of them ──
          Pills rather than a button per row in the list above: the list is for opening a
          role and editing it, and hanging a second action off each row would make every
          tap a question about which half was meant. The shape is the role picker on the
          person screen, which is the control this app already uses to pick a role.

          NONE leftmost, as it is there: it is an ordinary player with no role at all —
          all but a handful of profiles, and the preview most worth having.

          A tap takes the admin screen down and puts the badge up. The badge is the only
          way back, because a preview of a role without `admin` takes the link away. */}
      {canPreview && !loading && (
        <View className="mt-3 border-t border-dim/10 pt-3">
          <Text selectable={false} className={cn(TYPE.label, 'mb-1.5 text-dim')}>
            <Trans>PREVIEW AS</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {[null, ...rows].map((option) => (
              <TrackedPressable
                key={option?.key ?? 'none'}
                id="admin.role_preview"
                onPress={() => {
                  onPreview(option?.key ?? null, option?.label ?? null)
                }}
                className="rounded-lg border border-dim/30 px-2.5 py-1"
              >
                <Text selectable={false} className={cn(TYPE.rowLabel, 'text-dim')}>
                  {option?.label ?? 'NONE'}
                </Text>
              </TrackedPressable>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

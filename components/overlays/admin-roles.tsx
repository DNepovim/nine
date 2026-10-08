import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
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
  onChanged,
}: {
  epoch: number
  onOpenRole: (role: AdminRole) => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

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
        <TrackedPressable
          id="admin.role_new"
          onPress={() => {
            void handleCreate()
          }}
          disabled={busy || draft.trim() === ''}
          className={cn(
            'items-center justify-center rounded-lg bg-strong px-4',
            (busy || draft.trim() === '') && 'opacity-40',
          )}
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[1px] text-on-strong"
          >
            <Trans>ADD</Trans>
          </Text>
        </TrackedPressable>
      </View>

      {error !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
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
              <Text
                selectable={false}
                className="flex-1 font-mono text-[12px] font-black tracking-[1px] text-primary"
              >
                {item.label}
              </Text>
              {/* Features in the stack, then people holding the role. The second is the
                  warning the detail screen repeats: editing a stack moves all of them. */}
              <Text
                selectable={false}
                className="font-mono text-[10px] font-medium tracking-[0.5px] text-dim"
              >
                {item.featureCount} · {item.personCount}
              </Text>
            </TrackedPressable>
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}

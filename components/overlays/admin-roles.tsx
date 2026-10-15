import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminTable } from '@/components/overlays/admin-table'
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

// Making a role, in a dialog rather than in a field above the list.
//
// The field was the first thing on the screen and the last thing anybody wanted: roles
// are made once and read every time, so the list was opening two lines down from the top
// to leave room for an input that is used about twice a year. The press that opens this
// is under the list, where a thing done rarely belongs.
function NewRoleModal({
  busy,
  onCreate,
  onDismiss,
}: {
  busy: boolean
  // Returns whether the server took it, so the dialog knows whether to close. A refused
  // name must keep the dialog and the draft — retyping it is the one thing the reader
  // should not have to do.
  onCreate: (key: string, label: string) => Promise<boolean>
  onDismiss: () => void
}) {
  const [draft, setDraft] = useState('')
  const key = toKey(draft)

  return (
    <AdminDialog title={<Trans>NEW ROLE</Trans>} onDismiss={onDismiss}>
      <View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="new role"
          placeholderTextColor={DIM_INK}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          className="h-10 rounded-xl border border-muted bg-elevated px-2.5 font-mono font-bold tracking-[1px] text-primary"
        />
        {/* What the label will be stored as, shown while it is being typed. A role key is
            derived rather than entered — lower case, hyphenated — and this is the one
            moment that derivation is worth seeing, because the key is what
            `profiles.role` holds and what every guard in SQL is written against. */}
        <Text selectable={false} className={cn(TYPE.hint, 'mt-1.5 text-dim')}>
          {key === '' ? <Trans>a name, in capitals</Trans> : key}
        </Text>
        <PrimaryButton
          id="admin.role_new"
          className="mt-3"
          disabled={busy || key === ''}
          onPress={() => {
            void (async () => {
              if (await onCreate(key, draft.trim().toUpperCase())) onDismiss()
            })()
          }}
          label={<Trans>CREATE</Trans>}
        />
      </View>
    </AdminDialog>
  )
}

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
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  // The real answer, not a previewed one: a preview takes this screen down with it, so
  // the tile below can never be asking about the set it just installed.
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

  const create = async (key: string, label: string): Promise<boolean> => {
    setBusy(true)
    const res = await createRole(key, label)
    setBusy(false)
    setError(res.error)
    if (res.error !== null) return false
    onChanged()
    return true
  }

  return (
    <View className="flex-1">
      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AdminTable
          rowId="admin.role"
          loading={loading}
          error={error}
          columns={[
            { label: 'ROLE', tone: 'name' },
            // Features in the stack, then people holding the role. The second is the
            // warning the detail screen repeats: editing a stack moves all of them.
            { label: 'STACK', width: 44, align: 'right' },
            { label: 'HOLDING', width: 52, align: 'right' },
          ]}
          rows={rows.map((role) => ({
            key: role.key,
            cells: [role.label, `${role.featureCount}`, `${role.personCount}`],
            onPress: () => {
              onOpenRole(role)
            },
          }))}
          empty={<Trans>No roles yet.</Trans>}
        />

        <PrimaryButton
          id="admin.role_add"
          tone="quiet"
          className="mt-2.5"
          onPress={() => {
            setAdding(true)
          }}
          label={<Trans>NEW ROLE</Trans>}
        />

        {/* ── Wearing one of them ──
            A tile of its own under the list, rather than a footer inside its frame.
            Previewing a role is not a column of the table and not an action on a row: it
            is a different thing to do with the same set of names, and it takes the screen
            down with it when it is pressed. Its own card is what says so.

            Still not a button per row, for the reason it never was: the list is for
            opening a role and editing it, and hanging a second action off each row would
            make every tap a question about which half was meant.

            NONE leftmost, as it is everywhere this app offers a role: it is an ordinary
            player with no role at all — all but a handful of profiles, and the preview
            most worth having.

            A tap takes the admin screen down and puts the badge up. The badge is the only
            way back, because a preview of a role without `admin` takes the link away. */}
        {canPreview && !loading && (
          <View className="mt-2.5 rounded-xl border border-muted bg-card p-2.5">
            <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
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
                  className="h-8 justify-center rounded-lg border border-muted bg-surface px-2.5"
                >
                  <Text selectable={false} className={cn(TYPE.rowLabel, 'text-primary')}>
                    {option?.label ?? 'NONE'}
                  </Text>
                </TrackedPressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {adding && (
        <NewRoleModal
          busy={busy}
          onCreate={create}
          onDismiss={() => {
            setAdding(false)
          }}
        />
      )}
    </View>
  )
}

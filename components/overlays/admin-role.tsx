import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminChip, AdminTable, AdminTick } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { listFeatures, type AdminFeature } from '@/lib/admin/features'
import {
  loadRoleFeatures,
  renameRole,
  setRoleFeature,
  type AdminRole as Role,
} from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// One role: its name, who holds it, and the features in its stack. Plain on and off —
// a stack has no third state, because the tri-state belongs to one person's overrides
// and lives on the other screen, and the three positions of a feature's own switch are
// on the tab before it.
export function AdminRole({
  role,
  onChanged,
  onBack,
}: {
  role: Role
  onChanged: () => void
  // Where DONE goes too. A role is opened from the hub and finished with on the hub —
  // closing the whole admin screen from here was taking away the list the edit was
  // about to be read against.
  onBack: () => void
}) {
  const [features, setFeatures] = useState<AdminFeature[]>([])
  const [stack, setStack] = useState<ReadonlySet<string>>(new Set())
  const [label, setLabel] = useState(role.label)
  const [loading, setLoading] = useState(true)
  // A write about the whole role — the rename, the delete. The stack rows carry their
  // own, below, so that flipping one feature does not grey out the other twenty.
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [all, mine] = await Promise.all([listFeatures(), loadRoleFeatures(role.key)])
      setFeatures(all.rows)
      setStack(new Set(mine.keys))
      setError(all.error ?? mine.error)
      setLoading(false)
    })()
    // Read once on open, keyed on the role. Every write below reloads deliberately.
  }, [role.key])

  // The tick moves on the tap, and the server is read back after. Waiting on the round
  // trip before showing anything is what had this list wanting a second press.
  const toggle = async (key: string, on: boolean) => {
    setPending((current) => new Set(current).add(key))
    setStack((current) => {
      const next = new Set(current)
      if (on) next.delete(key)
      else next.add(key)
      return next
    })
    const res = await setRoleFeature(role.key, key, !on)
    setError(res.error)
    // Read back whether or not it was taken: a refused write has to put the tick back to
    // what the stack actually holds.
    const mine = await loadRoleFeatures(role.key)
    setStack(new Set(mine.keys))
    setPending((current) => {
      const left = new Set(current)
      left.delete(key)
      return left
    })
    if (res.error === null) onChanged()
  }

  const rename = async (next: string) => {
    setBusy(true)
    const res = await renameRole(role.key, next)
    setError(res.error)
    setBusy(false)
    if (res.error === null) onChanged()
  }

  const held = role.personCount

  return (
    <AdminScreen
      error={error}
      heading={
        // The role's own name is the heading, and it is editable in place — so this
        // screen passes a heading rather than a title, the same way the person screen
        // does with a nickname.
        <View className="mb-2.5 flex-row items-end justify-between gap-3">
          {/* Renaming is a blur, not a press — there is no button to give an id to,
              which is why `admin.role_rename` is not in the ButtonId union. */}
          <TextInput
            value={label}
            onChangeText={setLabel}
            onBlur={() => {
              const next = label.trim()
              if (next !== '' && next !== role.label) {
                void rename(next)
              }
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            className={cn(TYPE.cardTitle, 'h-9 flex-1 text-primary')}
          />
          {/* The count is the warning: editing the stack below moves every one of them
              who has not overridden the feature being changed. */}
          <Text selectable={false} className={cn(TYPE.hint, 'mb-1.5 text-dim')}>
            {held} <Trans>holding</Trans>
          </Text>
        </View>
      }
      footer={
        <PrimaryButton id="admin.done" onPress={onBack} label={<Trans>DONE</Trans>} />
      }
    >
      {/* The name above is a text field, and a tap that only puts the keyboard away is
          the tap somebody counts as the first of two. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
          <Trans>FEATURES IN THIS STACK</Trans>
        </Text>
        <AdminTable
          rowId="admin.role_feature"
          loading={loading}
          columns={[
            { width: 22 },
            { label: 'FEATURE', tone: 'name' },
            { width: 76, align: 'right' },
          ]}
          rows={features.map((feature) => {
            const on = stack.has(feature.key)
            return {
              key: feature.key,
              leads: false,
              // A hidden feature is faded: this stack decides nothing about it, and the
              // switch that does is on the FEATURES tab. A public one is not — the stack
              // has stopped deciding who reaches it, but it is still what the feature
              // falls back to the day somebody makes it private again, so the tick stays
              // worth setting.
              faded: feature.visibility === 'hidden',
              onPress: pending.has(feature.key)
                ? undefined
                : () => {
                    void toggle(feature.key, on)
                  },
              cells: [
                <AdminTick on={on} />,
                feature.key,
                feature.visibility === 'private' ? null : (
                  <AdminChip
                    label={feature.visibility === 'hidden' ? 'HIDDEN' : 'PUBLIC'}
                    tone={feature.visibility === 'hidden' ? 'quiet' : 'filled'}
                  />
                ),
              ],
            }
          })}
        />

        {/* **No DELETE ROLE.** It was here, under the stack, and it was shut on every
            role anybody would want to press it on: `delete_role` refuses a role somebody
            still holds — `still held by 3 people` — so the only roles it ever offered to
            delete were the empty ones nobody had got round to using. A button that is
            disabled whenever it would matter is a button that only ever teaches you it is
            disabled.

            Deleting a role is now what it was always closest to being: a thing done in
            SQL, deliberately, after the people holding it have been moved off it. The
            screen's job is the stack. */}
      </ScrollView>
    </AdminScreen>
  )
}

import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'

import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { listFeatures, type AdminFeature } from '@/lib/admin/features'
import {
  deleteRole,
  loadRoleFeatures,
  renameRole,
  setRoleFeature,
  type AdminRole as Role,
} from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// One role: its name, who holds it, and the features in its stack. Plain on and off —
// a stack has no third state, because the tri-state belongs to one person's overrides
// and lives on the other screen.
export function AdminRole({
  role,
  onChanged,
  onBack,
  onClose,
}: {
  role: Role
  onChanged: () => void
  onBack: () => void
  onClose: () => void
}) {
  const [features, setFeatures] = useState<AdminFeature[]>([])
  const [stack, setStack] = useState<ReadonlySet<string>>(new Set())
  const [label, setLabel] = useState(role.label)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
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

  const write = async (call: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await call()
    setError(res.error)
    const [all, mine] = await Promise.all([listFeatures(), loadRoleFeatures(role.key)])
    setFeatures(all.rows)
    setStack(new Set(mine.keys))
    setBusy(false)
    if (res.error === null) onChanged()
  }

  const held = role.personCount

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <View className="mb-1 flex-row items-center gap-3">
        <TrackedPressable id="admin.back" onPress={onBack} hitSlop={8}>
          <Text selectable={false} className="font-mono text-[16px] font-black text-dim">
            ‹
          </Text>
        </TrackedPressable>
        {/* Renaming is a blur, not a press — there is no button to give an id to, which
            is why `admin.role_rename` is not in the ButtonId union. */}
        <TextInput
          value={label}
          onChangeText={setLabel}
          onBlur={() => {
            const next = label.trim()
            if (next !== '' && next !== role.label) {
              void write(() => renameRole(role.key, next))
            }
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          className="flex-1 font-mono text-[18px] font-black tracking-[2px] text-primary"
        />
      </View>
      {/* The count is the warning: editing the stack below moves every one of them who
          has not overridden the feature being changed. */}
      <Text
        selectable={false}
        className="mb-4 ml-6 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        {held} <Trans>holding this role</Trans>
      </Text>

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
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            selectable={false}
            className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>FEATURES IN THIS STACK</Trans>
          </Text>
          {features.map((feature) => {
            const on = stack.has(feature.key)
            return (
              <TrackedPressable
                key={feature.key}
                id="admin.role_feature"
                disabled={busy}
                onPress={() => {
                  void write(() => setRoleFeature(role.key, feature.key, !on))
                }}
                className={cn('flex-row items-center py-2', busy && 'opacity-40')}
              >
                <Text
                  selectable={false}
                  className="w-5 font-mono text-[12px] font-black text-primary"
                >
                  {on ? '●' : '○'}
                </Text>
                <Text
                  selectable={false}
                  className={cn(
                    'flex-1 font-mono text-[12px] font-bold tracking-[0.5px] text-primary',
                    !feature.active && 'line-through',
                  )}
                >
                  {feature.key}
                </Text>
                {!feature.active && (
                  <Text
                    selectable={false}
                    className="font-mono text-[10px] font-medium text-dim"
                  >
                    <Trans>off for everyone</Trans>
                  </Text>
                )}
              </TrackedPressable>
            )
          })}

          <TrackedPressable
            id="admin.role_delete"
            disabled={busy || held > 0}
            onPress={() => {
              void write(async () => {
                const res = await deleteRole(role.key)
                if (res.error === null) onBack()
                return res
              })
            }}
            className={cn(
              'mt-5 items-center rounded-xl border border-red-500/40 py-3',
              (busy || held > 0) && 'opacity-40',
            )}
          >
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px] text-red-500"
            >
              <Trans>DELETE ROLE</Trans>
            </Text>
          </TrackedPressable>
        </ScrollView>
      )}

      <TrackedPressable
        id="admin.done"
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </TrackedPressable>
    </ScreenLayer>
  )
}

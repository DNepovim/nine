import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { listFeatures, setFeature, type AdminFeature } from '@/lib/admin/features'
import { cn } from '@/lib/cn'

// The one key nobody may switch off. The database refuses it too — a check constraint on
// `features`, because it has to hold against a migration as well as against this screen
// — and this is only so the switch does not look tappable.
const PROTECTED = 'admin'

export function AdminFeatures({
  epoch,
  onChanged,
}: {
  epoch: number
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The note is edited in place, so the field needs somewhere to live between keystrokes
  // that is not the row it came from.
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const res = await listFeatures()
      setRows(res.rows)
      setNotes(Object.fromEntries(res.rows.map((row) => [row.key, row.note ?? ''])))
      setError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  const write = async (call: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await call()
    setError(res.error)
    const reloaded = await listFeatures()
    setRows(reloaded.rows)
    setNotes(Object.fromEntries(reloaded.rows.map((row) => [row.key, row.note ?? ''])))
    setBusy(false)
    if (res.error === null) onChanged()
  }

  if (loading) return <ActivityIndicator className="my-4" />

  return (
    <View className="flex-1">
      {error !== null && (
        <Text
          selectable={false}
          className="mb-2 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
        >
          {error}
        </Text>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {rows.map((row) => {
          const locked = row.key === PROTECTED
          const note = notes[row.key] ?? ''
          return (
            <View key={row.key} className="mb-4">
              <View className="flex-row items-center">
                <TrackedPressable
                  id="admin.feature_active"
                  disabled={busy || locked}
                  onPress={() => {
                    void write(() =>
                      setFeature(row.key, !row.active, note === '' ? null : note),
                    )
                  }}
                  className={cn(
                    'mr-2 rounded-lg border px-2.5 py-1',
                    row.active ? 'border-strong bg-strong' : 'border-dim/30',
                    (busy || locked) && 'opacity-40',
                  )}
                >
                  <Text
                    selectable={false}
                    className={cn(
                      'font-mono text-[9px] font-black tracking-[1px]',
                      row.active ? 'text-on-strong' : 'text-dim',
                    )}
                  >
                    {row.active ? 'ON' : 'OFF'}
                  </Text>
                </TrackedPressable>
                <Text
                  selectable={false}
                  className="flex-1 font-mono text-[12px] font-black tracking-[0.5px] text-primary"
                >
                  {row.key}
                  {locked ? ' 🔒' : ''}
                </Text>
                {/* Roles granting it, then people who actually reach it — the second
                    counts overrides in, which is the number somebody about to flip the
                    switch wants. */}
                <Text
                  selectable={false}
                  className="font-mono text-[10px] font-medium tracking-[0.5px] text-dim"
                >
                  {row.roleCount} · {row.personCount}
                </Text>
              </View>

              {!row.inBuild && (
                <Text
                  selectable={false}
                  className="ml-1 mt-1 font-mono text-[10px] font-bold tracking-[0.5px] text-red-500"
                >
                  {/* A row the database holds and this build does not: a key left behind
                      by a migration, or a device older than the server. Shown rather than
                      hidden — unseen configuration is how it goes stale. */}
                  ⚠ <Trans>not in this build</Trans>
                </Text>
              )}

              <TextInput
                value={note}
                onChangeText={(next) => {
                  setNotes((current) => ({ ...current, [row.key]: next }))
                }}
                onBlur={() => {
                  if (note !== (row.note ?? '')) {
                    void write(() =>
                      setFeature(row.key, row.active, note === '' ? null : note),
                    )
                  }
                }}
                placeholder="why"
                multiline
                className="ml-1 mt-1 font-mono text-[10px] font-medium leading-[15px] text-dim"
              />
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

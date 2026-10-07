import { Trans } from '@lingui/react/macro'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { listFeatures, setFeature, type AdminFeature } from '@/lib/admin/features'
import { cn } from '@/lib/cn'

// The one key nobody may switch off. The database refuses it too — a check constraint on
// `features`, because it has to hold against a migration as well as against this screen
// — and this is only so the switch does not look tappable.
const PROTECTED = 'admin'

// What the note fields hold after a read. A draft beats what the server just said: a
// note being typed in one row has to survive a switch being flipped in another, and
// every write on this screen reads the whole list back.
const mergeNotes = (
  rows: readonly AdminFeature[],
  current: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(rows.map((row) => [row.key, current[row.key] ?? row.note ?? '']))

// One row with its switch already moved, for the optimistic half of a toggle.
const withActive = (
  rows: readonly AdminFeature[],
  key: string,
  active: boolean,
): AdminFeature[] => rows.map((row) => (row.key === key ? { ...row, active } : row))

export function AdminFeatures({
  epoch,
  onChanged,
}: {
  epoch: number
  onChanged: () => void
}) {
  const [rows, setRows] = useState<AdminFeature[]>([])
  const [loading, setLoading] = useState(true)
  // Which keys have a write in flight, rather than one flag for the screen. A single
  // `busy` dimmed every row at once and disabled all of them — which is what a tap on
  // one switch read as: the whole list flashing, and the next tap landing on nothing.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  // The same answer as `pending`, readable the moment it changes rather than on the next
  // render. A tap on a row's switch blurs that row's note field in the same breath, and
  // the blur handler has to be able to see the write the tap already sent.
  const inFlight = useRef<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  // The note is edited in place, so the field needs somewhere to live between keystrokes
  // that is not the row it came from.
  const [notes, setNotes] = useState<Record<string, string>>({})

  // Only the first read has nothing to draw, so only the first read is allowed to blank
  // the list. `epoch` bumps after this screen's own writes as well, and swapping the
  // rows for a spinner on each of those was the screen flashing on every tap.
  useEffect(() => {
    void (async () => {
      const res = await listFeatures()
      setRows(res.rows)
      setNotes((current) => mergeNotes(res.rows, current))
      setError(res.error)
      setLoading(false)
    })()
  }, [epoch])

  // Every write is the same three moves — mark that key busy, call, read the whole list
  // back — because a refused write has to put its row back to what the server holds.
  const write = async (key: string, call: () => Promise<{ error: string | null }>) => {
    inFlight.current.add(key)
    setPending((current) => new Set(current).add(key))
    const res = await call()
    setError(res.error)
    const reloaded = await listFeatures()
    setRows(reloaded.rows)
    setNotes((current) => mergeNotes(reloaded.rows, current))
    inFlight.current.delete(key)
    setPending((current) => {
      const left = new Set(current)
      left.delete(key)
      return left
    })
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
      {/* The notes are text fields in this very list, and a tap that only puts the
          keyboard away is the tap somebody counts as the first of two. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {rows.map((row) => {
          const locked = row.key === PROTECTED
          const note = notes[row.key] ?? ''
          return (
            <View key={row.key} className="mb-4">
              <View className="flex-row items-center">
                <TrackedPressable
                  id="admin.feature_active"
                  disabled={pending.has(row.key) || locked}
                  onPress={() => {
                    const next = !row.active
                    // The switch moves on the tap. A write and a read stand between the
                    // press and the truth, and a control that shows nothing until both
                    // land is a control you press again.
                    setRows((current) => withActive(current, row.key, next))
                    void write(row.key, () =>
                      setFeature(row.key, next, note === '' ? null : note),
                    )
                  }}
                  className={cn(
                    'mr-2 rounded-lg border px-2.5 py-1',
                    row.active ? 'border-strong bg-strong' : 'border-dim/30',
                    locked && 'opacity-40',
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
                  // A tap on this row's switch blurs this field, and that write carried
                  // the draft below with it. Writing again from here would only send the
                  // switch back to where it stood before the tap.
                  if (inFlight.current.has(row.key)) return
                  if (note !== (row.note ?? '')) {
                    void write(row.key, () =>
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

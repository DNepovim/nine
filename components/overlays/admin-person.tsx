import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import {
  loadPersonFeatures,
  resetUserFeatures,
  setUserFeature,
  setUserRole,
  type AdminPerson as Person,
  type PersonFeature,
} from '@/lib/admin/people'
import { listRoles, type AdminRole } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'
import { sourceOf, toggleOverride, type FeatureSource } from '@/lib/features'

// What each of the five answers says on the row. The point of printing the *source*
// rather than only the state is that "why can this person see this" is answerable here
// rather than by opening the other two tabs and doing the arithmetic.
const SOURCE_LABEL: Record<FeatureSource, string> = {
  inactive: 'off for everyone',
  'role-on': 'from role',
  'role-off': 'from role',
  'override-on': 'override',
  'override-off': 'override',
}

const isOn = (source: FeatureSource) => source === 'role-on' || source === 'override-on'

function FeatureRow({
  row,
  pending,
  onToggle,
}: {
  row: PersonFeature
  // This row's own write is in flight. Per row rather than one flag for the screen: a
  // single `busy` dimmed every row at once, which is what a tap on one of them read as.
  pending: boolean
  onToggle: () => void
}) {
  const source = sourceOf(row)
  // An inactive feature is nobody's to change from here — the switch for it is on the
  // FEATURES tab, and offering a tap that cannot take effect would be a lie.
  const locked = source === 'inactive'
  return (
    <TrackedPressable
      id="admin.person_feature"
      onPress={onToggle}
      disabled={pending || locked}
      className={cn('flex-row items-center py-2', locked && 'opacity-40')}
    >
      <Text
        selectable={false}
        className="w-5 font-mono text-[12px] font-black text-primary"
      >
        {isOn(source) ? '●' : '○'}
      </Text>
      <Text
        selectable={false}
        className={cn(
          'flex-1 font-mono text-[12px] font-bold tracking-[0.5px] text-primary',
          locked && 'line-through',
        )}
      >
        {row.key}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-medium tracking-[0.5px] text-dim"
      >
        {SOURCE_LABEL[source]}
      </Text>
    </TrackedPressable>
  )
}

// One person: the role they hold, every feature with where its answer came from, and
// the way back to the role's own stack.
export function AdminPerson({
  person,
  onChanged,
  onBack,
}: {
  person: Person
  onChanged: () => void
  // Where DONE goes too. A person is opened from the hub and finished with on the hub —
  // closing the whole admin screen from here was taking away the list the edit was
  // about to be read against.
  onBack: () => void
}) {
  const [roles, setRoles] = useState<AdminRole[]>([])
  // The role is held here rather than read off `person`, which is the row the list
  // handed over and never hears about a write. Set only after the server accepts one:
  // the lockout guards can refuse a role change, and a picker that moved on the tap
  // would be claiming a change the server rejected.
  const [role, setRole] = useState<string | null>(person.role)
  const [rows, setRows] = useState<PersonFeature[]>([])
  const [loading, setLoading] = useState(true)
  // A write about the whole person — the role picker. The feature rows carry their own,
  // keyed below, so that toggling one override does not grey out the other twenty.
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // The same gradient the list drew this name in, so opening somebody does not change
  // the colour they were recognised by.
  const factorsOf = usePlayerFactors(person.nickname === null ? EMPTY_IDS : [person.id])

  useEffect(() => {
    void (async () => {
      const [roleList, featureList] = await Promise.all([
        listRoles(),
        loadPersonFeatures(person.id),
      ])
      setRoles(roleList.rows)
      setRows(featureList.rows)
      setError(roleList.error ?? featureList.error)
      setLoading(false)
    })()
    // Read once on open, keyed on the person rather than on anything that moves. Every
    // write below reloads deliberately rather than through a dependency changing,
    // because a refused write has to reload too.
  }, [person.id])

  // Every write is the same three moves — say busy, call, read the whole person back —
  // because a refused write is as interesting as an accepted one here. The guards can
  // refuse any of these, and the row has to go back to what the server actually holds
  // rather than to what the tap assumed.
  const write = async (call: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    const res = await call()
    setError(res.error)
    const [roleList, featureList] = await Promise.all([
      listRoles(),
      loadPersonFeatures(person.id),
    ])
    setRoles(roleList.rows)
    setRows(featureList.rows)
    setBusy(false)
    if (res.error === null) onChanged()
  }

  // The dot moves on the tap, and the person is read back after. Waiting on the round
  // trip before showing anything is what had these rows wanting a second press.
  const toggle = async (row: PersonFeature) => {
    const next = toggleOverride(row.override, row.inRoleStack)
    setPending((current) => new Set(current).add(row.key))
    setRows((current) =>
      current.map((r) => (r.key === row.key ? { ...r, override: next } : r)),
    )
    const res = await setUserFeature(person.id, row.key, next)
    setError(res.error)
    // Read back whether or not it was taken: a refused write has to put the row back to
    // what the server actually holds.
    const featureList = await loadPersonFeatures(person.id)
    setRows(featureList.rows)
    setPending((current) => {
      const left = new Set(current)
      left.delete(row.key)
      return left
    })
    if (res.error === null) onChanged()
  }

  const hasOverrides = rows.some((row) => row.override !== null)

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <View className="mb-4 flex-row items-center gap-3">
        <TrackedPressable id="admin.back" onPress={onBack} hitSlop={8}>
          <Text selectable={false} className="font-mono text-[16px] font-black text-dim">
            ‹
          </Text>
        </TrackedPressable>
        {person.nickname === null ? (
          <Text
            selectable={false}
            className="font-mono text-[18px] font-black tracking-[2px] text-primary"
          >
            <Trans>(no nickname)</Trans>
          </Text>
        ) : (
          <GradientName
            nickname={person.nickname}
            avgAccuracy={factorsOf(person.id).avgAccuracy}
            avgSpeed={factorsOf(person.id).avgSpeed}
            numberOfLines={1}
            className="font-mono text-[18px] font-black tracking-[2px]"
          />
        )}
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            selectable={false}
            className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>ROLE</Trans>
          </Text>
          {/* NONE leftmost, as it has been: it is the one option that undoes the other
              three, and any order that put it last would bury it. */}
          <View className="mb-5 flex-row flex-wrap gap-1.5">
            {[null, ...roles.map((r) => r.key)].map((option) => {
              const active = option === role
              return (
                <TrackedPressable
                  key={option ?? 'none'}
                  id="admin.person_role"
                  disabled={busy || active}
                  onPress={() => {
                    void write(async () => {
                      const res = await setUserRole(person.id, option)
                      if (res.error === null) setRole(option)
                      return res
                    })
                  }}
                  className={cn(
                    'rounded-lg border px-2.5 py-1',
                    active ? 'border-strong bg-strong' : 'border-dim/30',
                    busy && !active && 'opacity-40',
                  )}
                >
                  <Text
                    selectable={false}
                    className={cn(
                      'font-mono text-[9px] font-black tracking-[1px]',
                      active ? 'text-on-strong' : 'text-dim',
                    )}
                  >
                    {option === null
                      ? 'NONE'
                      : (roles.find((r) => r.key === option)?.label ?? option)}
                  </Text>
                </TrackedPressable>
              )
            })}
          </View>

          <Text
            selectable={false}
            className="mb-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Trans>FEATURES</Trans>
          </Text>
          {rows.map((row) => (
            <FeatureRow
              key={row.key}
              row={row}
              pending={pending.has(row.key)}
              onToggle={() => {
                void toggle(row)
              }}
            />
          ))}

          <TrackedPressable
            id="admin.person_reset"
            disabled={busy || !hasOverrides}
            onPress={() => {
              void write(() => resetUserFeatures(person.id))
            }}
            className={cn(
              'mt-5 items-center rounded-xl border border-dim/30 py-3',
              (busy || !hasOverrides) && 'opacity-40',
            )}
          >
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
            >
              <Trans>RESET TO ROLE DEFAULTS</Trans>
            </Text>
          </TrackedPressable>
        </ScrollView>
      )}

      <TrackedPressable
        id="admin.done"
        onPress={onBack}
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

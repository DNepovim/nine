import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSelect } from '@/components/overlays/admin-select'
import { AdminTable, AdminTick } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
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
import {
  featureLabel,
  sourceOf,
  toggleOverride,
  type FeatureSource,
} from '@/lib/features'

// What each of the six answers says on the row. The point of printing the *source*
// rather than only the state is that "why can this person see this" is answerable here
// rather than by opening the other two tabs and doing the arithmetic.
const SOURCE_LABEL: Record<FeatureSource, string> = {
  hidden: 'hidden from everyone',
  public: 'public',
  'role-on': 'from role',
  'role-off': 'from role',
  'override-on': 'override',
  'override-off': 'override',
}

const isOn = (source: FeatureSource) =>
  source === 'role-on' || source === 'override-on' || source === 'public'

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

  // The tick moves on the tap, and the person is read back after. Waiting on the round
  // trip before showing anything is what had these rows wanting a second press.
  const toggle = async (row: PersonFeature) => {
    const next = toggleOverride(row)
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

  // A public feature is not listed: it reaches everybody, and nothing on this screen can
  // change that. Making it public deleted every override on it, so RESET counts the rows
  // that are listed and those are all there are — see
  // 20261023010000_public_beats_override.sql.
  const shown = rows.filter((row) => row.visibility !== 'public')
  const hasOverrides = shown.some((row) => row.override !== null)

  return (
    <AdminScreen
      error={error}
      heading={
        // The person's own name is the heading, so this screen passes one rather than a
        // title: a nickname is drawn in that player's own colours and cannot be handed to
        // `AdminTitle`, which spells a word out across the app's spectrum.
        //
        // The role sits on the same line as the name. It is one setting about the person
        // whose features fill the rest of the screen — a row of pills above that list was
        // a control taking two lines to say what a closed combobox says in one, and
        // taking them whether or not anybody was going to change it.
        <View className="mb-2.5 flex-row items-center justify-between gap-3">
          {person.nickname === null ? (
            <Text selectable={false} className={cn(TYPE.cardTitle, 'shrink text-dim')}>
              <Trans>(no nickname)</Trans>
            </Text>
          ) : (
            <GradientName
              nickname={person.nickname}
              avgAccuracy={factorsOf(person.id).avgAccuracy}
              avgSpeed={factorsOf(person.id).avgSpeed}
              numberOfLines={1}
              className={cn(TYPE.cardTitle, 'shrink')}
            />
          )}
          <AdminSelect
            title={<Trans>ROLE</Trans>}
            disabled={busy || loading}
            value={role}
            className="w-[124px]"
            // NONE first, as it has been: it is the one option that undoes all the
            // others, and any order that put it last would bury it.
            options={[
              { value: null, label: 'NONE', note: <Trans>An ordinary player</Trans> },
              ...roles.map((r) => ({ value: r.key, label: r.label })),
            ]}
            onSelect={(option) => {
              void write(async () => {
                const res = await setUserRole(person.id, option)
                if (res.error === null) setRole(option)
                return res
              })
            }}
          />
        </View>
      }
      footer={
        <PrimaryButton id="admin.done" onPress={onBack} label={<Trans>DONE</Trans>} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
          <Trans>FEATURES</Trans>
        </Text>
        <AdminTable
          rowId="admin.person_feature"
          loading={loading}
          columns={[
            { width: 22 },
            { label: 'FEATURE', tone: 'name' },
            { label: 'WHERE FROM', width: 96, align: 'right' },
          ]}
          rows={shown.map((row) => {
            const source = sourceOf(row)
            // A hidden feature is nobody's to change from here — the switch for it is on
            // the FEATURES tab, and offering a tap that cannot take effect would be a
            // lie.
            const locked = source === 'hidden'
            return {
              key: row.key,
              leads: false,
              faded: locked,
              onPress:
                locked || pending.has(row.key)
                  ? undefined
                  : () => {
                      void toggle(row)
                    },
              cells: [
                <AdminTick on={isOn(source)} />,
                featureLabel(row.key),
                SOURCE_LABEL[source],
              ],
            }
          })}
        />

        <PrimaryButton
          id="admin.person_reset"
          tone="quiet"
          className="mt-3"
          disabled={busy || !hasOverrides}
          onPress={() => {
            void write(() => resetUserFeatures(person.id))
          }}
          label={<Trans>RESET TO ROLE DEFAULTS</Trans>}
        />
      </ScrollView>
    </AdminScreen>
  )
}

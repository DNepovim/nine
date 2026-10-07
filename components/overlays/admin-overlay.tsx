import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { AdminFeatures } from '@/components/overlays/admin-features'
import { AdminPeople } from '@/components/overlays/admin-people'
import { AdminPerson } from '@/components/overlays/admin-person'
import { AdminRole } from '@/components/overlays/admin-role'
import { AdminRoles } from '@/components/overlays/admin-roles'
import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { type AdminPerson as Person } from '@/lib/admin/people'
import { type AdminRole as Role } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// Three objects now — people, roles, features — so three tabs. Pills rather than a new
// shared control: the role picker on the person screen is already this shape, and a
// second way of drawing the same affordance is a second thing to keep in step.
//
// The detail screens are state here rather than panes of their own, because both are
// reached from a list and both go back to it: holding the open person or role on the hub
// is what makes a single BACK work for either.
type Tab = 'people' | 'roles' | 'features'

const TABS: readonly Tab[] = ['people', 'roles', 'features']

// Not translated, and not an oversight. These name the three database objects, and they
// sit beside role labels that are rows and cannot carry a message id — translating one
// half of a row of pills would read worse than translating neither.
const TAB_LABEL: Record<Tab, string> = {
  people: 'PEOPLE',
  roles: 'ROLES',
  features: 'FEATURES',
}

export function AdminOverlay({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('people')
  const [person, setPerson] = useState<Person | null>(null)
  const [role, setRole] = useState<Role | null>(null)

  // One counter rather than three reload callbacks: every list here is a snapshot, and
  // an edit on a detail screen has to be able to tell the list behind it to read again.
  const [epoch, setEpoch] = useState(0)
  const refresh = () => {
    setEpoch((n) => n + 1)
  }

  if (person !== null) {
    return (
      <AdminPerson
        person={person}
        onChanged={refresh}
        onBack={() => {
          setPerson(null)
        }}
      />
    )
  }

  if (role !== null) {
    return (
      <AdminRole
        role={role}
        onChanged={refresh}
        onBack={() => {
          setRole(null)
        }}
      />
    )
  }

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>ADMIN</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-4 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Trans>WHO SEES WHAT</Trans>
      </Text>

      <View className="mb-4 flex-row gap-1.5">
        {TABS.map((option) => {
          const active = option === tab
          return (
            <TrackedPressable
              key={option}
              id="admin.tab"
              onPress={() => {
                setTab(option)
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5',
                active ? 'border-strong bg-strong' : 'border-dim/30',
              )}
            >
              <Text
                selectable={false}
                className={cn(
                  'font-mono text-[10px] font-black tracking-[1px]',
                  active ? 'text-on-strong' : 'text-dim',
                )}
              >
                {TAB_LABEL[option]}
              </Text>
            </TrackedPressable>
          )
        })}
      </View>

      {tab === 'people' && <AdminPeople epoch={epoch} onOpenPerson={setPerson} />}
      {tab === 'roles' && (
        <AdminRoles epoch={epoch} onOpenRole={setRole} onChanged={refresh} />
      )}
      {tab === 'features' && <AdminFeatures epoch={epoch} onChanged={refresh} />}

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

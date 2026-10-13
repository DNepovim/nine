import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { AdminFeatures } from '@/components/overlays/admin-features'
import { AdminPeople } from '@/components/overlays/admin-people'
import { AdminPerson } from '@/components/overlays/admin-person'
import { AdminRole } from '@/components/overlays/admin-role'
import { AdminRoles } from '@/components/overlays/admin-roles'
import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { type AdminPerson as Person } from '@/lib/admin/people'
import { type AdminRole as Role } from '@/lib/admin/roles'
import { cn } from '@/lib/cn'

// Who sees what: three objects — people, roles, features — so three tabs. Pills rather
// than a new shared control: the role picker on the person screen is already this shape,
// and a second way of drawing the same affordance is a second thing to keep in step.
//
// The detail screens are state here rather than panes of their own, because both are
// reached from a list and both go back to it: holding the open person or role *on this
// screen* is what makes a single BACK work for either. That is also why the whole of
// this moved out of `admin-overlay.tsx` in one piece when the hub arrived rather than
// leaving the routing behind — a BACK out of a person has to land on the list it was
// opened from, and a hub holding that state would have put it on the hub instead.
//
// On screen this is **FEATURES**, which is the button the hub draws for it. The file and
// the component say *access* because `admin-features.tsx` already means the FEATURES tab
// inside it, and two files called features at two depths is how a directory stops being
// navigable. Same arrangement as host/`admin` and CLAIM/`accept` elsewhere in the app.
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

export function AdminAccess({
  viewerId,
  onBack,
}: {
  // Who is reading, so the people list can say which row is theirs. This screen is the one
  // place a person can take a feature off themselves, and knowing which row that is before
  // opening it is worth a tag.
  viewerId: string | null
  // To the hub. Not `onClose`: the hub is where the other section is, and finishing with
  // one of two sections is not finishing with admin.
  onBack: () => void
}) {
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
      <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-1 text-primary')}>
        <Trans>FEATURES</Trans>
      </Text>
      <Text selectable={false} className={cn(TYPE.label, 'mb-4 text-dim')}>
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
                className={cn(TYPE.label, active ? 'text-on-strong' : 'text-dim')}
              >
                {TAB_LABEL[option]}
              </Text>
            </TrackedPressable>
          )
        })}
      </View>

      {tab === 'people' && (
        <AdminPeople epoch={epoch} viewerId={viewerId} onOpenPerson={setPerson} />
      )}
      {tab === 'roles' && (
        <AdminRoles epoch={epoch} onOpenRole={setRole} onChanged={refresh} />
      )}
      {tab === 'features' && <AdminFeatures epoch={epoch} onChanged={refresh} />}

      <PrimaryButton
        id="admin.back"
        onPress={onBack}
        className="mt-4 self-center"
        style={{ width: 224 }}
        label={<Trans>BACK</Trans>}
      />
    </ScreenLayer>
  )
}

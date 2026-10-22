import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'

import { AdminFeature } from '@/components/overlays/admin-feature'
import { AdminFeatures } from '@/components/overlays/admin-features'
import { AdminPeople } from '@/components/overlays/admin-people'
import { AdminPerson } from '@/components/overlays/admin-person'
import { AdminRole } from '@/components/overlays/admin-role'
import { AdminRoles } from '@/components/overlays/admin-roles'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import { PrimaryButton } from '@/components/primary-button'
import { type AdminFeature as Feature } from '@/lib/admin/features'
import { type AdminPerson as Person } from '@/lib/admin/people'
import { type AdminRole as Role } from '@/lib/admin/roles'

// Who sees what: three objects — people, roles, features — so three tabs.
//
// The detail screens are state here rather than panes of their own, because each is
// reached from a list and goes back to it: holding the open person, role or feature *on
// this screen* is what makes a single BACK work for any of them. That is also why the whole of
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
// half of a row of segments would read worse than translating neither.
const TAB_LABEL: Record<Tab, string> = {
  people: 'PEOPLE',
  roles: 'ROLES',
  features: 'FEATURES',
}

const TITLE = msg`FEATURES`

export function AdminAccess({
  viewerId,
  onPreview,
  onBack,
}: {
  // Who is reading, so the people list can say which row is theirs. This screen is the one
  // place a person can take a feature off themselves, and knowing which row that is before
  // opening it is worth a tag.
  viewerId: string | null
  // Wear a role and go and look — handed through to the ROLES tab, which is where the
  // roles are. Goes all the way up to the app root rather than being held here: the set
  // it moves is the one the whole tree is drawn from, and the first thing a preview does
  // is take this screen down.
  onPreview: (role: string | null, label: string | null) => void
  // To the hub. Not `onClose`: the hub is where the other section is, and finishing with
  // one of two sections is not finishing with admin.
  onBack: () => void
}) {
  const { t } = useLingui()
  const [tab, setTab] = useState<Tab>('people')
  const [person, setPerson] = useState<Person | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [feature, setFeature] = useState<Feature | null>(null)

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

  if (feature !== null) {
    return (
      <AdminFeature
        feature={feature}
        onChanged={refresh}
        onBack={() => {
          setFeature(null)
        }}
      />
    )
  }

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton id="admin.back" onPress={onBack} label={<Trans>BACK</Trans>} />
      }
    >
      {/* One control rather than three loose pills, and short: it sits above the list it
          sorts, and every pixel it takes is a pixel of that list. */}
      <AdminSegments
        id="admin.tab"
        className="mb-2.5"
        value={tab}
        onSelect={setTab}
        options={TABS.map((option) => ({ value: option, label: TAB_LABEL[option] }))}
      />

      {tab === 'people' && (
        <AdminPeople epoch={epoch} viewerId={viewerId} onOpenPerson={setPerson} />
      )}
      {tab === 'roles' && (
        <AdminRoles
          epoch={epoch}
          onOpenRole={setRole}
          onPreview={onPreview}
          onChanged={refresh}
        />
      )}
      {tab === 'features' && <AdminFeatures epoch={epoch} onOpenFeature={setFeature} />}
    </AdminScreen>
  )
}

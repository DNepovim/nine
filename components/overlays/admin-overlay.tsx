import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { AdminAccess } from '@/components/overlays/admin-access'
import { AdminSessions } from '@/components/overlays/admin-sessions'
import { CardButton } from '@/components/overlays/run-screen'
import { PrimaryButton } from '@/components/primary-button'
import { ScreenLayer } from '@/components/screen'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The admin door, which is now a crossroads rather than a screen.
//
// Two things are administered and they have nothing to do with each other: **who sees
// what** — people, roles, features — and **when a challenge is on**. Both sit behind the
// one `admin` feature, which is the key the link on the intro already asks for and the
// one the database refuses to let anybody switch off.
//
// A hub rather than a fourth tab beside PEOPLE / ROLES / FEATURES. Those three are three
// views of one question, and a tab row is how a reader is told that; a session is a
// different question entirely, and hanging it off the same row would have said it was
// another way of looking at a person.
//
// This file keeps its name and its export so `app/(tabs)/index.tsx` is untouched: what
// opens ADMIN has no business knowing the screen behind it grew a fork.
type Section = 'hub' | 'access' | 'sessions'

export function AdminOverlay({
  viewerId,
  onPreview,
  onClose,
}: {
  // Who is reading, handed through to the people list so it can say which row is theirs.
  viewerId: string | null
  // Wear a role and go and look, handed through to the ROLES tab. Starting one takes this
  // screen down — the caller does both, because the set a preview installs is the one the
  // link back here is drawn from.
  onPreview: (role: string | null, label: string | null) => void
  onClose: () => void
}) {
  const [section, setSection] = useState<Section>('hub')
  const toHub = () => {
    setSection('hub')
  }

  if (section === 'access') {
    return <AdminAccess viewerId={viewerId} onPreview={onPreview} onBack={toHub} />
  }
  if (section === 'sessions') return <AdminSessions onBack={toHub} />

  return (
    <ScreenLayer className="px-6 pb-6 pt-16">
      {/* No subtitle. The one it used to carry, WHO SEES WHAT, went with the tabs it
          described — and two labelled buttons do not need a line explaining that they
          are the two things there are. */}
      <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-8 text-primary')}>
        <Trans>ADMIN</Trans>
      </Text>

      {/* `CardButton leads` rather than two primary buttons: these are doors, not the
          thing this screen is for, and two gradient slabs over a third one read as three
          equal decisions. The same dress the pause screen puts on its own card pills and
          Trainee's option tiles — a card, a leading label, and a chevron saying it goes
          somewhere. DONE stays the loud one, because leaving is what a hub is mostly for.

          Pinned to the CTA's own width so the column has one edge rather than two. */}
      <View className="flex-1 gap-3 self-center" style={{ width: 224 }}>
        <CardButton
          id="admin.section"
          leads
          onPress={() => {
            setSection('access')
          }}
          label={<Trans>FEATURES</Trans>}
        />
        <CardButton
          id="admin.section"
          leads
          onPress={() => {
            setSection('sessions')
          }}
          label={<Trans>CHALLENGES</Trans>}
        />
      </View>

      <PrimaryButton
        id="admin.done"
        onPress={onClose}
        className="mt-4 self-center"
        style={{ width: 224 }}
        label={<Trans>DONE</Trans>}
      />
    </ScreenLayer>
  )
}

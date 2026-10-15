import { Trans } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { Visibility } from '@/lib/features'

// How far out a feature has got, asked as a question rather than cycled.
//
// The switch used to be a 68px pill that moved on every tap: hidden → private → public →
// hidden. Three things were wrong with that, and all three are about this being the one
// control on the admin screens that changes what players can see. It took three taps to
// get back to where you started, it was the loudest press in the app with no way to think
// better of it, and the position it landed on was a 9px word in a row of twenty. Making a
// feature public is in front of every player by the time anybody notices the row.
//
// So the row keeps a button and the button opens this: the three positions as three
// targets a thumb cannot miss, each with the sentence that says who it reaches, and a
// CONFIRM under them. Nothing is written until that press — closing the dialog is how a
// reader changes their mind, and the scrim and the 5-dot both do it.
//
// The three names stay untranslated, as the pill's did and as the feature keys beside
// them do: the people who open this screen are the people who write the catalog. The
// sentences are copy, and copy is extracted.
const ORDER: readonly Visibility[] = ['hidden', 'private', 'public']

const NAME: Record<Visibility, string> = {
  hidden: 'HIDDEN',
  private: 'PRIVATE',
  public: 'PUBLIC',
}

// Who each position reaches, in the words the migration uses for it. Ordered as the three
// widen — nobody, then whoever holds it, then everybody — which is the order the cycle
// moved in and the one thing about it worth keeping.
const REACH: Record<Visibility, ReactNode> = {
  hidden: <Trans>Nobody, whatever a role or an override says.</Trans>,
  private: <Trans>Whoever their role's stack or their own override says.</Trans>,
  public: <Trans>Everybody, role or no role.</Trans>,
}

function Option({
  value,
  chosen,
  onChoose,
}: {
  value: Visibility
  chosen: boolean
  onChoose: () => void
}) {
  return (
    <TrackedPressable
      id="admin.visibility_option"
      onPress={onChoose}
      // Tall on purpose: this is the one dialog in the app whose whole job is to be
      // pressed accurately, and a row of this height cannot be missed by a thumb holding
      // the phone it is on. The border is two pixels in both states so that choosing one
      // does not move the words inside it.
      className={cn(
        'min-h-[54px] flex-row items-center gap-2.5 rounded-xl border-2 px-2.5 py-2',
        chosen ? 'border-strong bg-card' : 'border-muted',
      )}
    >
      {/* The ring, and the dot inside it when this is the answer. Drawn rather than
          lettered — ● and ○ at two sizes is what the feature rows used to say it with,
          and they do not line up with each other at any size. */}
      <View
        className={cn(
          'h-[20px] w-[20px] items-center justify-center rounded-full border-2',
          chosen ? 'border-strong' : 'border-muted',
        )}
      >
        {chosen && <View className="h-[9px] w-[9px] rounded-full bg-strong" />}
      </View>
      <View className="flex-1">
        <Text
          selectable={false}
          className={cn(TYPE.buttonSm, chosen ? 'text-primary' : 'text-dim')}
        >
          {NAME[value]}
        </Text>
        <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
          {REACH[value]}
        </Text>
      </View>
    </TrackedPressable>
  )
}

export function AdminVisibilityModal({
  featureKey,
  visibility,
  onConfirm,
  onDismiss,
}: {
  featureKey: string
  visibility: Visibility
  // Called with the chosen position once CONFIRM is pressed. The dialog does not write —
  // the list owns the write, the optimistic row and the read-back, as it did when this
  // was a pill.
  onConfirm: (next: Visibility) => void
  onDismiss: () => void
}) {
  // Held here, so the three targets answer immediately and the write still waits for
  // CONFIRM. That split is the point of the dialog: a press that shows something and a
  // press that does something.
  const [chosen, setChosen] = useState<Visibility>(visibility)

  return (
    // The feature's key as the title, which is what this screen calls a feature
    // everywhere else.
    <AdminDialog title={featureKey} onDismiss={onDismiss}>
      <View className="gap-1.5">
        {ORDER.map((option) => (
          <Option
            key={option}
            value={option}
            chosen={option === chosen}
            onChoose={() => {
              setChosen(option)
            }}
          />
        ))}
      </View>
      <PrimaryButton
        id="admin.visibility_confirm"
        className="mt-3"
        // Shut while the answer on screen is the answer the server already holds: there
        // is nothing to confirm, and a live button there would report a write that
        // changed nothing.
        disabled={chosen === visibility}
        onPress={() => {
          onConfirm(chosen)
          onDismiss()
        }}
        label={<Trans>CONFIRM</Trans>}
      />
    </AdminDialog>
  )
}

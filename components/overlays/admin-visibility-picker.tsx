import { Trans } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'

import { AdminChip } from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { VISIBILITY_INK } from '@/constants/colors'
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
// So it is three targets a thumb cannot miss, each with the sentence that says who it
// reaches, and a CONFIRM under them. Nothing is written until that press. It was a dialog
// raised from the row, and is now drawn on the feature's own screen, where the people it
// reaches are listed under it — the answer to *who will this move* is on the same page as
// the switch that moves them.
//
// The three names stay untranslated, as the feature keys beside them do: the people who
// open this screen are the people who write the catalog. The sentences are copy, and copy
// is extracted.
const ORDER: readonly Visibility[] = ['hidden', 'private', 'public']

const VISIBILITY_NAME: Record<Visibility, string> = {
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

// A visibility as a chip, in its own hue. Here beside the names so that the list, the
// feature's screen and a role's stack all say a position the same way.
export function VisibilityChip({
  visibility,
  className,
}: {
  visibility: Visibility
  className?: string
}) {
  return (
    <AdminChip
      label={VISIBILITY_NAME[visibility]}
      hue={VISIBILITY_INK[visibility]}
      className={className}
    />
  )
}

function Option({
  value,
  chosen,
  disabled,
  onChoose,
}: {
  value: Visibility
  chosen: boolean
  disabled: boolean
  onChoose: () => void
}) {
  const ink = VISIBILITY_INK[value]
  return (
    <TrackedPressable
      id="admin.visibility_option"
      disabled={disabled}
      onPress={onChoose}
      // Tall on purpose: this is the one control in the app whose whole job is to be
      // pressed accurately, and a row of this height cannot be missed by a thumb holding
      // the phone it is on. The border is two pixels in both states so that choosing one
      // does not move the words inside it.
      className={cn(
        'min-h-[54px] flex-row items-center gap-2.5 rounded-xl border-2 px-2.5 py-2',
        chosen ? 'bg-card' : 'border-muted',
        disabled && 'opacity-40',
      )}
      style={chosen ? { borderColor: ink } : undefined}
    >
      {/* The ring, and the dot inside it when this is the answer — both in the
          position's own hue, so the three read as the chips in the list do. */}
      <View
        className="h-[20px] w-[20px] items-center justify-center rounded-full border-2"
        style={{ borderColor: ink }}
      >
        {chosen && (
          <View
            className="h-[9px] w-[9px] rounded-full"
            style={{ backgroundColor: ink }}
          />
        )}
      </View>
      <View className="flex-1">
        <Text
          selectable={false}
          className={TYPE.buttonSm}
          style={{ color: chosen ? ink : undefined }}
        >
          {VISIBILITY_NAME[value]}
        </Text>
        <Text selectable={false} className={cn(TYPE.hint, 'mt-0.5 text-dim')}>
          {REACH[value]}
        </Text>
      </View>
    </TrackedPressable>
  )
}

export function AdminVisibilityPicker({
  visibility,
  disabled = false,
  onConfirm,
}: {
  // What the server holds now.
  visibility: Visibility
  // The protected key, or a write still in flight.
  disabled?: boolean
  // Called with the chosen position once CONFIRM is pressed. The picker does not write —
  // the screen owns the write, the optimistic value and the read-back.
  onConfirm: (next: Visibility) => void
}) {
  // Held here, so the three targets answer immediately and the write still waits for
  // CONFIRM. That split is the point: a press that shows something and a press that does
  // something. The caller keys this on `visibility`, so a refused confirm read back as
  // the old position starts the choice over from there.
  const [chosen, setChosen] = useState<Visibility>(visibility)

  return (
    <View>
      <View className="gap-1.5">
        {ORDER.map((option) => (
          <Option
            key={option}
            value={option}
            chosen={option === chosen}
            disabled={disabled}
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
        disabled={disabled || chosen === visibility}
        onPress={() => {
          onConfirm(chosen)
        }}
        label={<Trans>CONFIRM</Trans>}
      />
    </View>
  )
}

import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One of several, as a closed control that opens a list: the role a person holds, the
// window the figures are read over.
//
// A row of pills was the shape these screens used for every choice, and it stops working
// the moment the choice is not the subject of the screen it is on. The role picker was
// four pills wrapping over two lines above the list that is actually being edited — a
// control taking more room than the thing it qualifies, and taking it permanently. A
// combobox is one line that says what the answer currently is, which is what a reader
// wants from a setting nine times out of ten, and spends its space only when asked.
//
// Pills are still right where the choice *is* the screen: the challenge a session airs is
// what the form is for, and `AdminPills` keeps that one.
export type AdminOption<T> = {
  value: T
  // Not translated, by and large: role labels and database keys are rows rather than
  // copy. A caller whose options are copy passes nodes.
  label: ReactNode
  // One line under the label inside the open list, where an option needs saying as well
  // as naming. Never drawn on the closed control, which has one line.
  note?: ReactNode
}

export function AdminSelect<T>({
  title,
  options,
  value,
  onSelect,
  disabled = false,
  className,
}: {
  // What the dialog is called while it is open — the question being answered.
  title: ReactNode
  options: readonly AdminOption<T>[]
  value: T
  onSelect: (value: T) => void
  disabled?: boolean
  // Placement only — a margin, a width. Never the shape.
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const chosen = options.find((option) => option.value === value)

  return (
    <>
      <TrackedPressable
        id="admin.select"
        disabled={disabled}
        onPress={() => {
          setOpen(true)
        }}
        className={cn(
          'h-9 flex-row items-center justify-between gap-2 rounded-xl border border-muted bg-elevated px-2.5',
          disabled && 'opacity-40',
          className,
        )}
      >
        <Text
          selectable={false}
          numberOfLines={1}
          className={cn(TYPE.rowLabel, 'shrink text-primary')}
        >
          {chosen?.label ?? '—'}
        </Text>
        {/* Down rather than the lists' forward: this opens over the screen instead of
            going to another one. */}
        <Ionicons name="chevron-down" size={12} color={DIM_INK} />
      </TrackedPressable>

      {open && (
        <AdminDialog
          title={title}
          onDismiss={() => {
            setOpen(false)
          }}
        >
          <View className="gap-1.5">
            {options.map((option) => {
              const active = option.value === value
              return (
                <TrackedPressable
                  key={String(option.value)}
                  id="admin.select_option"
                  onPress={() => {
                    // Answered on the press, with no second confirm. The one choice on
                    // these screens that needs confirming is a feature's visibility, which
                    // has its own CONFIRM and its own reason — see
                    // `AdminVisibilityPicker`. Everything else here is undone by choosing
                    // again.
                    onSelect(option.value)
                    setOpen(false)
                  }}
                  // Tall enough to be aimed at with the hand holding the phone, which is
                  // the whole reason this is a window rather than a list hanging under the
                  // row it belongs to.
                  className={cn(
                    'min-h-[44px] flex-row items-center gap-2 rounded-xl border px-2.5 py-2',
                    active ? 'border-strong bg-surface' : 'border-muted',
                  )}
                >
                  <View className="w-[16px]">
                    {active && <Ionicons name="checkmark" size={16} color={DIM_INK} />}
                  </View>
                  <View className="flex-1">
                    <Text
                      selectable={false}
                      className={cn(TYPE.buttonSm, active ? 'text-primary' : 'text-dim')}
                    >
                      {option.label}
                    </Text>
                    {option.note !== undefined && (
                      <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                        {option.note}
                      </Text>
                    )}
                  </View>
                </TrackedPressable>
              )
            })}
          </View>
        </AdminDialog>
      )}
    </>
  )
}

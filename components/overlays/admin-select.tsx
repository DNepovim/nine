import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

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
// The challenge a session airs was the one choice kept on pills, as the subject of its
// form. It moved here when each challenge came to carry a mark, its own colours and how
// often it has run — three things a pill has no room for, across a couple of dozen of
// them. `icon` and `detail` are what that caller asked for.
export type AdminOption<T> = {
  value: T
  // Not translated, by and large: role labels and database keys are rows rather than
  // copy. A caller whose options are copy passes nodes.
  label: ReactNode
  // One line under the label inside the open list, where an option needs saying as well
  // as naming. Never drawn on the closed control, which has one line.
  note?: ReactNode
  // Drawn before the label, on the closed control and in the list alike — the session
  // form's challenge marks. Outside the label's `Text`, since a drawing cannot sit in one.
  icon?: ReactNode
  // A figure at the far end of the row, in the open list only: how many times a challenge
  // has run, beside its name.
  detail?: ReactNode
}

export function AdminSelect<T>({
  title,
  options,
  value,
  onSelect,
  placeholder = '—',
  disabled = false,
  className,
}: {
  // What the dialog is called while it is open — the question being answered.
  title: ReactNode
  options: readonly AdminOption<T>[]
  // Null is nothing chosen yet — a new session before its challenge is picked.
  value: T | null
  onSelect: (value: T) => void
  // What the closed control says while `value` matches no option.
  placeholder?: ReactNode
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
        <View className="shrink flex-row items-center gap-2">
          {chosen?.icon}
          <Text
            selectable={false}
            numberOfLines={1}
            className={cn(TYPE.rowLabel, 'shrink', chosen ? 'text-primary' : 'text-dim')}
          >
            {chosen?.label ?? placeholder}
          </Text>
        </View>
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
          {/* Scrolls once it outgrows the window, which the catalog of challenges does and
              a handful of roles never will. */}
          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
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
                    {option.icon}
                    <View className="flex-1">
                      <Text
                        selectable={false}
                        className={cn(
                          TYPE.buttonSm,
                          active ? 'text-primary' : 'text-dim',
                        )}
                      >
                        {option.label}
                      </Text>
                      {option.note !== undefined && (
                        <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                          {option.note}
                        </Text>
                      )}
                    </View>
                    {option.detail !== undefined && (
                      <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
                        {option.detail}
                      </Text>
                    )}
                  </TrackedPressable>
                )
              })}
            </View>
          </ScrollView>
        </AdminDialog>
      )}
    </>
  )
}

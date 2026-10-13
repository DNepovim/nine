import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'
import type { DateTimeFieldComponent, DateTimeFieldProps } from '@/types/date-time-field'

// One instant on the planner's form, set with the **system** picker — the platform's own
// wheel on iOS, its own dialog on Android, and `<input type="datetime-local">` on web
// (see the `.web.tsx` sibling, which is the one production actually serves).
//
// Two platform paths rather than three files, and the split is narrow on purpose:
// Android's picker is imperative and opens itself, iOS's is a component that has to be
// rendered. Both answer through `onValueChange`, which fires only when a value was
// actually chosen — a dismissal goes to `onDismiss` and there is nothing to do about
// one — so the two differ in how the picker is summoned and in nothing else.
//
// `onValueChange` rather than the older `onChange`, which is deprecated in 9.x and
// reported both outcomes through one handler with the difference encoded in the event.

// Android asks for the day and the time in two dialogs, because its picker does only one
// at a time. The second opens on whatever the first produced, so the time lands on the
// day the admin just chose rather than on the day they started from.
function openAndroid(value: number, onChange: (next: number) => void): void {
  DateTimePickerAndroid.open({
    value: new Date(value),
    mode: 'date',
    onValueChange: (_dayEvent, day) => {
      DateTimePickerAndroid.open({
        value: day,
        mode: 'time',
        onValueChange: (_timeEvent, settled) => {
          onChange(settled.getTime())
        },
      })
    },
  })
}

export const DateTimeField: DateTimeFieldComponent = ({
  label,
  value,
  onChange,
  invalid = false,
}: DateTimeFieldProps) => {
  // iOS only. Android's picker is its own window and keeps no state here; web has no
  // open state at all, since the input is the field.
  const [open, setOpen] = useState(false)

  return (
    <View className="py-2">
      <TrackedPressable
        id="admin.session_when"
        onPress={() => {
          if (Platform.OS === 'android') {
            openAndroid(value, onChange)
            return
          }
          setOpen((shown) => !shown)
        }}
        className="flex-row items-center justify-between gap-3"
      >
        <Text selectable={false} className={cn(TYPE.label, 'text-dim')}>
          {label}
        </Text>
        <Text
          selectable={false}
          // `text-red-500` rather than a theme token, because that is what the other
          // admin screens already say when something is wrong — see the error line in
          // admin-role.tsx. No token exists for a refusal, and inventing one here would
          // be a palette change made inside a form.
          className={cn(TYPE.figure, invalid ? 'text-red-500' : 'text-primary')}
        >
          {formatDayTime(value)}
        </Text>
      </TrackedPressable>

      {open && (
        <DateTimePicker
          value={new Date(value)}
          mode="datetime"
          // The wheel rather than iOS 14's compact field: this row already *is* the
          // field, and `compact` would have drawn a second one inside it.
          display="spinner"
          onValueChange={(_event, picked) => {
            onChange(picked.getTime())
          }}
        />
      )}
    </View>
  )
}

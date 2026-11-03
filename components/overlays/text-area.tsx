import { Platform, TextInput } from 'react-native'

import { DIM_INK } from '@/constants/colors'
import { cn } from '@/lib/cn'

// A few lines of free text inside a dialog: what a player writes to TELL US, and the
// **remark** under a rating.
//
// Lifted out of the feedback dialog when the rating dialog's second step asked for the
// same field, rather than copied into it — two text areas that started identical are two
// that drift apart, and the web font-size quirk below is exactly the kind of thing a copy
// loses.
export function TextArea({
  value,
  onChange,
  placeholder,
  maxLength,
  editable = true,
  className,
}: {
  value: string
  onChange: (text: string) => void
  // A string, not a node: `TextInput` draws its placeholder itself.
  placeholder: string
  maxLength: number
  editable?: boolean
  // Placement only — a margin. Never the shape.
  className?: string
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      multiline
      editable={editable}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={DIM_INK}
      className={cn(
        'h-32 w-full rounded-2xl border border-muted bg-card p-3 font-mono leading-[18px] text-primary',
        className,
      )}
      // Mobile Safari zooms the whole page in on focus for any input under 16px — the one
      // web quirk with no CSS opt-out, only a bigger font. Native has no such behaviour,
      // so it keeps the smaller size the rest of the sheet uses.
      style={{
        textAlignVertical: 'top',
        fontSize: Platform.OS === 'web' ? 16 : 12,
      }}
    />
  )
}

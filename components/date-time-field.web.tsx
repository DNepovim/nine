import { Text, View } from 'react-native'

import { mono } from '@/constants/theme'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { DateTimeFieldComponent, DateTimeFieldProps } from '@/types/date-time-field'

// The same field over `<input type="datetime-local">`, which *is* the system picker on
// web: the browser draws the calendar and the clock, and it does it in the reader's own
// locale and zone. This is the variant production serves — the deploy ships the web
// bundle — so it is the one that has to be right rather than the fallback.
//
// A bare DOM `input` rather than a React Native `TextInput`. `react-native-web` renders
// a `TextInput` as an `<input>` but gives no way to ask for this `type`, and a text field
// that an admin has to type an instant into by hand is not a picker.

// What the input wants: 'YYYY-MM-DDTHH:mm', in **local** time and with no zone on it.
// Built by hand rather than through `toISOString`, which would hand over UTC and quietly
// shift every field by the reader's offset.
function toInputValue(ms: number): string {
  const at = new Date(ms)
  const pad = (part: number) => String(part).padStart(2, '0')
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${day}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

// And back. The guard is the whole reason this is a named function.
//
// `new Date('2026-10-11T12:00')` is parsed as local time, which is what we want — but
// `new Date('2026-10-11')` is parsed as **UTC**, and the input yields exactly that
// shape while a date has been picked and a time has not. Reading one of those would move
// the instant by the admin's offset, so it would look right in London and be an hour
// out in Prague. A value with no time in it is not an answer, and is ignored until the
// browser has both halves.
function fromInputValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at.getTime()
}

export const DateTimeField: DateTimeFieldComponent = ({
  label,
  value,
  onChange,
  invalid = false,
}: DateTimeFieldProps) => (
  <View className="flex-row items-center justify-between gap-3 py-2">
    <Text selectable={false} className={cn(TYPE.label, 'text-dim')}>
      {label}
    </Text>
    {/* Styled inline rather than with `className`: this is a DOM node, so NativeWind's
        transform does not reach it and the tokens would be dropped on the floor. The
        font and the colours are read off the same places the rest of the form reads
        them — see constants/typography.ts and global.css. */}
    <input
      type="datetime-local"
      value={toInputValue(value)}
      onChange={(event) => {
        const next = fromInputValue(event.target.value)
        if (next !== null) onChange(next)
      }}
      style={{
        // `TYPE.figure` spelled out — the role the native sibling wears as a class, which
        // a DOM node cannot. These two must move with `figure` in constants/typography.ts.
        //
        // Not imported from there, and that is not laziness: `knip.json` ignores
        // `**/*.web.tsx`, so an export whose only consumer is this file reads as dead code
        // and fails the gate. Tried twice — once for this and once for the red below — and
        // both times the export had to come back out. See the review notes.
        fontFamily: mono,
        fontSize: 11,
        fontWeight: 700,
        // Tailwind's `red-500`, spelled out: this is a DOM node, so the `text-red-500`
        // the native field and eighteen other call sites use cannot reach it. Kept here
        // rather than exported from constants/colors.ts because knip ignores
        // `**/*.web.tsx` — an export whose only consumer is invisible to it reads as
        // dead code on every run of the gate.
        color: invalid ? '#ef4444' : 'var(--color-primary)',
        background: 'transparent',
        border: 'none',
        padding: 0,
        textAlign: 'right',
      }}
    />
  </View>
)

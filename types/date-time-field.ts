import type { ReactNode } from 'react'

// The contract both halves of `DateTimeField` are held to.
//
// A file of its own, and the reason is the one thing `pnpm check` cannot otherwise
// catch. The native field and `date-time-field.web.tsx` are alternatives rather than
// callers — nothing imports both, so a prop one of them gained and the other did not
// would type-check on each platform and break on one. And knip ignores `**/*.web.tsx`
// outright, so it is no help either. With both variants typed as
// `(props: DateTimeFieldProps) => ReactNode`, `tsc` is the guard.
//
// Not placed beside the components for a duller reason: Expo resolves
// `@/components/date-time-field` to the `.web.tsx` variant on web, so a type exported
// from the native file and imported by the web one would resolve back to itself.
export type DateTimeFieldProps = {
  // What this instant is — STARTS, ENDS. A node rather than a string because every
  // caller has a `<Trans>` to hand.
  label: ReactNode
  // The instant on show, ms since the epoch. The field never holds a draft: the screen
  // owns the span, so a change goes up and comes back down, which is what keeps the
  // start and the end able to move each other.
  value: number
  onChange: (next: number) => void
  // Drawn under the row when the pair it belongs to is not a span — the end at or
  // before the start. The field does not work out whether it is at fault; the screen
  // knows which half the admin just touched.
  invalid?: boolean
}

// Both variants are typed as this, which is what makes `tsc` the guard described above.
export type DateTimeFieldComponent = (props: DateTimeFieldProps) => ReactNode

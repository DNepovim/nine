import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type RefObject,
} from 'react'

// A tap beside the card closes the dialog it is beside — every dialog in the app, so the
// way out is the same one whether or not the player found the header's cross. Except when
// there is something typed inside it: a half-written message, an address, a name. That is
// what is held here.
//
// Two halves, because the field is rarely in the same component as the scrim. The host —
// `ModalCard`, `CardModal` — keeps the ref and hands the reporter down; the card with the
// field in it reports. A dialog whose field is its own (the feedback sheet) says so with
// `ModalCard`'s `held` prop instead and never touches this.
//
// A ref rather than state, and a function rather than a value, because nothing on screen
// changes with it: it is read once, at the moment the tap lands.
const HoldContext = createContext<((held: boolean) => void) | null>(null)

export const HoldProvider = HoldContext.Provider

// The host's half: the ref a scrim press reads, and the reporter to put on the provider.
export function useDialogHold(): {
  held: RefObject<boolean>
  report: (held: boolean) => void
} {
  const held = useRef(false)
  const report = useCallback((next: boolean) => {
    held.current = next
  }, [])
  return { held, report }
}

// The card's half. Called with whether the field has anything in it that closing would
// throw away — while it does, a tap beside the card is ignored and the ways out are the
// ones that say what they do.
//
// It reports false as it unmounts, so a card that hands over to another one — the address
// to the six digits — does not leave the dialog held shut by a field that has gone.
export function useHoldsDialogOpen(held: boolean) {
  const report = useContext(HoldContext)
  useEffect(() => {
    report?.(held)
    return () => {
      report?.(false)
    }
  }, [held, report])
}

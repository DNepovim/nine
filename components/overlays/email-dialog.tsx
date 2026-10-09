import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

import { EmailCodeModal } from '@/components/overlays/email-code-modal'
import { EmailModal } from '@/components/overlays/email-modal'
import { ModalCard } from '@/components/overlays/modal-card'
import { PRIMARY_INK } from '@/constants/colors'
import type { AccountEmailFlow } from '@/hooks/use-account-email'

// What each card is asking, in the header rather than inside the card. The question is the
// whole of what either one is about, so a label over it — PROFILE, or anything else — would
// only be a second heading saying less than the first. It takes primary ink for the same
// reason: it is the heading now, not a category the dialog belongs to.
const TITLES = {
  address: msg`WHERE CAN WE REACH YOU?`,
  code: msg`DID IT REACH YOU?`,
} as const satisfies Record<'address' | 'code', MessageDescriptor>

// The dialog the address flow wears, and the flow is the whole of what it takes: which of
// the two cards is up is the flow's own business, and this only draws whichever it is.
//
// One `ModalCard` around both of them rather than one apiece, which is what lets the field
// turn over to the six digits in place: one scrim, one header, and no entrance replayed in
// the middle of a task the player is already halfway through. The same arrangement
// `CardModal` makes for the nickname, for the same reason — and this one is the app's
// ordinary dialog, so the two cards now arrive looking like every other one.
//
// `avoidKeyboard` because both cards have something to type in, and this is an overlay
// inside the app rather than a platform modal — see `ModalCard`.
export function EmailDialog({ flow }: { flow: AccountEmailFlow }) {
  const { t } = useLingui()
  // Read out once, so the branch below narrows and stays narrowed inside the callback.
  const card = flow.card
  if (card === null) return null

  return (
    <ModalCard
      closeButton={false}
      title={t(TITLES[card.kind])}
      titleColor={PRIMARY_INK}
      avoidKeyboard
      onDismiss={flow.dismiss}
    >
      {(close) =>
        card.kind === 'address' ? (
          <EmailModal typed={card.typed} onSend={flow.send} onDismiss={close} />
        ) : (
          <EmailCodeModal
            branch={card.branch}
            address={card.address}
            sentAt={card.sentAt}
            done={card.done ?? false}
            onConfirm={flow.confirm}
            onResend={flow.resend}
            onEditAddress={flow.editAddress}
            onDismiss={close}
          />
        )
      }
    </ModalCard>
  )
}

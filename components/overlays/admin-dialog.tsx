import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { CardModal } from '@/components/overlays/card-modal'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// Every dialog the admin screens raise, in one shape.
//
// **A window, and not the app's `ModalCard`** — which is the decision this file exists to
// hold in one place. `ModalCard` is `absolute inset-0` of *its own parent*, which is right
// for a dialog a screen opens and wrong for every dialog here: these are raised from
// inside a pane, a list row or a 36px heading, so against their parents they would be
// drawn inside the content area with the screen's title and its BACK button left outside
// the scrim — visible, and still pressable, behind a dialog asking a question. A platform
// modal covers the screen from wherever it was opened. `CardModal` is that window, and the
// note on it carries both of the reasons one is used.
//
// What it costs is the app's dialog dress: no spectrum edge, no 5-dot close, no CLOSE
// button under the content. None of the three is missed. A dialog on these screens is
// answered by answering it — CONFIRM, CREATE, or picking a row — and a tap beside it is
// the way out, which the scrim already is.
export function AdminDialog({
  title,
  onDismiss,
  children,
}: {
  // What the dialog is asking, in the heading role a card uses for its own header.
  title: ReactNode
  onDismiss: () => void
  children: ReactNode
}) {
  return (
    // `visible` is always true because the caller mounts this when it is wanted and
    // unmounts it when it is not — so a dismissal is a straight unmount, with the
    // window's own fade-in on the way up and no fade on the way down. Deliberate, and the
    // one place in the app that trade is taken: the dialogs here are answered rather than
    // browsed, and what is behind them is a row whose figure has just changed, which is
    // the thing worth looking at.
    <CardModal visible onRequestClose={onDismiss}>
      <Text selectable={false} className={cn(TYPE.heading, 'mb-2.5 text-dim')}>
        {title}
      </Text>
      <View>{children}</View>
    </CardModal>
  )
}

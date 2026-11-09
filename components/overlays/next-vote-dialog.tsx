import { Trans } from '@lingui/react/macro'
import { View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ModalCard } from '@/components/overlays/modal-card'
import {
  NextVote,
  NextVoteTitle,
  useVoteView,
  VOTE_INK,
  voteFill,
} from '@/components/overlays/next-vote'
import type { VoteOption } from '@/lib/session-ratings'

// The vote in a dialog of its own, opened from the link on the intro. The same body the
// rating dialog's third step holds; this is only its frame. The way out is a quiet link, as
// that step's is, rather than the card's CTA CLOSE — the dialog asks for a pick, and a
// loud button under it would read as the thing to press.
export function NextVoteDialog({
  options,
  onVote,
  onDismiss,
}: {
  options: readonly VoteOption[]
  onVote: (modeId: string) => void
  onDismiss: () => void
}) {
  const view = useVoteView(options)
  const fill = voteFill(view)
  return (
    <ModalCard
      title={<NextVoteTitle settled={view.settled} />}
      titleKey={String(view.settled)}
      titleColor={fill === undefined ? undefined : VOTE_INK}
      fill={fill}
      closeButton={false}
      onDismiss={onDismiss}
    >
      {(close) => (
        <View className="items-center">
          <NextVote options={options} onVote={onVote} onClose={close} view={view} />
          <LinkButton
            id="vote.dismiss"
            className="mt-5"
            icon="close-outline"
            light={fill !== undefined}
            label={<Trans>CLOSE</Trans>}
            onPress={close}
          />
        </View>
      )}
    </ModalCard>
  )
}

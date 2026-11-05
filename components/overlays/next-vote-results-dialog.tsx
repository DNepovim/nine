import { Plural, Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { ModalCard } from '@/components/overlays/modal-card'
import { VotePie } from '@/components/overlays/vote-pie'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { VoteOption } from '@/lib/session-ratings'
import { gradientOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

const PIE_SIZE = 140

// Where the vote stands: a pie of the two options and a line under it for each, in the
// slice's colour. Opened from the intro by a player who has already voted, who is the only
// one the counts are shown to — they would be a bandwagon for somebody still choosing.
export function NextVoteResultsDialog({
  options,
  onDismiss,
}: {
  options: readonly VoteOption[]
  onDismiss: () => void
}) {
  return (
    <ModalCard title={<Trans>THE VOTE</Trans>} closeButton={false} onDismiss={onDismiss}>
      {(close) => (
        <View className="w-full items-center">
          <View className="mt-5">
            <VotePie
              size={PIE_SIZE}
              slices={options.map((option) => ({
                value: option.votes,
                color: gradientOf(option.modeId)[1],
              }))}
            />
          </View>
          <View className="mt-5 w-full gap-3">
            {options.map((option) => (
              <View
                key={option.sessionId}
                className="flex-row items-center justify-between gap-3"
              >
                <View className="shrink flex-row items-center gap-2">
                  <ChallengeMark
                    modeId={option.modeId}
                    color={challengeInk(gradientOf(option.modeId)[1])}
                    size={22}
                  />
                  <ChallengeTitle modeId={option.modeId} wrap />
                </View>
                <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
                  <Plural value={option.votes} one="# VOTE" other="# VOTES" />
                </Text>
              </View>
            ))}
          </View>
          <LinkButton
            id="vote.dismiss"
            className="mt-5"
            icon="close-outline"
            label={<Trans>CLOSE</Trans>}
            onPress={close}
          />
        </View>
      )}
    </ModalCard>
  )
}

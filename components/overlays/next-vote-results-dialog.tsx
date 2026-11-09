import { Plural, Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ChallengeMark } from '@/components/overlays/challenge-mark'
import { ChallengeName } from '@/components/overlays/challenge-name'
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
// one choosing the counts are held back from — they would be a bandwagon for somebody
// still choosing — and by one who may not vote, who is told why under the pie.
export function NextVoteResultsDialog({
  options,
  onDismiss,
}: {
  options: readonly VoteOption[]
  onDismiss: () => void
}) {
  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0)
  return (
    <ModalCard title={<Trans>THE VOTE</Trans>} closeButton={false} onDismiss={onDismiss}>
      {(close) => (
        <View className="w-full items-center">
          {/* Only once there is something to divide: one vote is a whole disc in one
              challenge's colours, which says "decided" about a vote that has barely begun. */}
          {totalVotes > 1 && (
            <View className="mt-5">
              {/* From six o'clock, so the first option's slice is on the left, over the
                  name standing on the left below. */}
              <VotePie
                size={PIE_SIZE}
                from={Math.PI}
                slices={options.map((option) => ({
                  value: option.votes,
                  colors: gradientOf(option.modeId),
                }))}
              />
            </View>
          )}
          {/* Side by side, each in its own column: the name large and in its gradient, the
              count under it. */}
          <View className="mt-5 w-full flex-row gap-3">
            {options.map((option) => (
              <View key={option.modeId} className="flex-1 items-center gap-1.5">
                <ChallengeMark
                  modeId={option.modeId}
                  color={challengeInk(gradientOf(option.modeId)[1])}
                  size={22}
                />
                <ChallengeName
                  modeId={option.modeId}
                  className={cn(TYPE.cardTitle, 'text-center')}
                />
                <Text selectable={false} className={cn(TYPE.labelSm, 'text-dim')}>
                  <Plural value={option.votes} one="# VOTE" other="# VOTES" />
                </Text>
              </View>
            ))}
          </View>
          {!(options[0]?.canVote ?? true) && (
            <Text
              selectable={false}
              className={cn(TYPE.proseSm, 'mt-5 text-center text-dim')}
            >
              <Trans>You can't vote because you didn't play the last challenge.</Trans>
            </Text>
          )}
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

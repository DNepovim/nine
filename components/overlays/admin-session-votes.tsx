import { Plural, Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { VotePie } from '@/components/overlays/vote-pie'
import { TYPE } from '@/constants/typography'
import type { SessionVoter } from '@/lib/admin/session-detail'
import type { AdminSession as Session } from '@/lib/admin/sessions'
import { cn } from '@/lib/cn'
import { votesFor } from '@/lib/session-voting'
import { gradientOf } from '@/modes'

const PIE_SIZE = 120

// A session's ballot, as the admin reads it: the challenge it runs — or, while the vote is
// on, the one ahead — in the larger type, the other candidate under it in the smaller, each
// with its votes; and, where asked, the pie and the voters.
//
// One block for the live, the past and the planned detail, because they are the same
// ballot at three moments. `counted` is whether to print votes at all: a planned session
// that is not being voted on has none to show, and "0 VOTES" there would claim a vote
// nobody has been asked to take.
export function AdminSessionVotes({
  session,
  voters,
  counted,
  pie = false,
  list = false,
}: {
  session: Session
  // Null where the read was refused or failed; the names still draw, without the figures.
  voters: readonly SessionVoter[] | null
  counted: boolean
  pie?: boolean
  list?: boolean
}) {
  const candidates = [
    { modeId: session.modeId, large: true },
    ...(session.altModeId === null ? [] : [{ modeId: session.altModeId, large: false }]),
  ]
  // A session booked with one challenge had no ballot, so there is nothing to count.
  const showFigures = counted && voters !== null && session.altModeId !== null
  const nameless = voters?.filter((voter) => voter.nickname === null).length ?? 0
  const named = voters?.filter((voter) => voter.nickname !== null) ?? []

  return (
    <View>
      {candidates.map(({ modeId, large }) => (
        <View
          key={modeId}
          className={cn('flex-row items-baseline justify-between', !large && 'mt-1')}
        >
          <ChallengeTitle
            modeId={modeId}
            className={large ? TYPE.screenTitle : TYPE.buttonSm}
            wrap
          />
          {showFigures && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <Plural value={votesFor(voters, modeId)} one="# VOTE" other="# VOTES" />
            </Text>
          )}
        </View>
      ))}

      {pie && showFigures && session.altModeId !== null && (
        <View className="mt-4 items-center">
          <VotePie
            size={PIE_SIZE}
            slices={candidates.map(({ modeId }) => ({
              value: votesFor(voters, modeId),
              color: gradientOf(modeId)[1],
            }))}
          />
        </View>
      )}

      {list && voters !== null && (
        <View className="mt-4">
          <Text selectable={false} className={cn(TYPE.caption, 'mb-1.5 text-dim')}>
            <Trans>VOTERS</Trans>
          </Text>
          {voters.length === 0 ? (
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              <Trans>Nobody voted yet.</Trans>
            </Text>
          ) : (
            <>
              {named.map((voter) => (
                <View
                  key={`${voter.nickname ?? ''}-${String(voter.votedAt)}`}
                  className="flex-row items-center justify-between py-0.5"
                >
                  <Text selectable={false} className={cn(TYPE.rowLabel, 'text-primary')}>
                    {voter.nickname}
                  </Text>
                  <ChallengeTitle modeId={voter.modeId} className={TYPE.hint} />
                </View>
              ))}
              {nameless > 0 && (
                <Text selectable={false} className={cn(TYPE.hint, 'mt-1 text-dim')}>
                  <Plural
                    value={nameless}
                    one="+ # without a nickname"
                    other="+ # without a nickname"
                  />
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  )
}

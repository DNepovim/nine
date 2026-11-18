import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ChallengeTitle } from '@/components/overlays/admin-session-cells'
import { TYPE } from '@/constants/typography'
import type { AdminMessage } from '@/lib/admin/feedback'
import { cn } from '@/lib/cn'
import { formatDayTime } from '@/lib/format-date'

// What an opened message was about, under its words.
//
// A message was written on a run, so it carries the mode, difficulty and score the player
// was looking at and the build they were on — the facts that turn a complaint into
// something reproducible. A remark was written about a session of a challenge, so it
// carries the challenge, when that session opened and the figure the player gave it, which
// are the facts that say which contest the words are about.
export function MessageContext({ message }: { message: AdminMessage }) {
  if (message.kind === 'message') {
    return (
      <Text selectable className={cn(TYPE.hint, 'text-dim')}>
        {message.mode} · {message.difficulty} · {message.score} · {message.build}
      </Text>
    )
  }

  const { session } = message
  return (
    <View className="gap-0.5">
      <ChallengeTitle modeId={message.mode} />
      {session !== null && (
        <Text selectable className={cn(TYPE.hint, 'text-dim')}>
          <Trans>SESSION</Trans> {formatDayTime(session.opensAt)}
          {' · '}
          {session.rating === null ? (
            <Trans>NOT RATED</Trans>
          ) : (
            <Trans>RATED {session.rating}/9</Trans>
          )}
        </Text>
      )}
    </View>
  )
}

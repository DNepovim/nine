import { useCallback, useEffect, useState } from 'react'

import { loadVoteOptions, voteNext, type VoteOption } from '@/lib/session-ratings'

// **The vote**: which of the next two challenges opens first. Read when asked for, so a
// player who never reaches the dialog or the intro line costs no request.
//
// `options` is empty while the read is out and where there is no choice; `voted` is the
// option the caller picked, which is also what turns the counts on — the dialog shows them
// only to somebody who has taken part.
export function useNextVote(enabled: boolean): {
  options: readonly VoteOption[]
  voted: VoteOption | null
  // Votes for a candidate, named by its challenge: both candidates share a session.
  vote: (modeId: string) => void
} {
  const [options, setOptions] = useState<readonly VoteOption[]>([])

  const read = useCallback(async () => {
    setOptions(await loadVoteOptions())
  }, [])

  useEffect(() => {
    if (!enabled) return
    void read()
  }, [enabled, read])

  // Counted on the screen first so the press answers at once, then replaced by the
  // server's own figures. A refusal reads again and puts back whatever is true.
  const vote = useCallback(
    (modeId: string) => {
      const session = options[0]?.sessionId
      if (session === undefined) return
      setOptions((prev) =>
        prev.map((option) => ({
          ...option,
          mine: option.modeId === modeId,
          votes:
            option.votes +
            (option.modeId === modeId && !option.mine ? 1 : 0) -
            (option.modeId !== modeId && option.mine ? 1 : 0),
        })),
      )
      void voteNext(session, modeId).then(read)
    },
    [options, read],
  )

  return { options, voted: options.find((option) => option.mine) ?? null, vote }
}

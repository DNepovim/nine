import { useCallback, useEffect, useRef, useState } from 'react'

import { noteRequest } from '@/lib/connectivity'
import { toReplies, type FeedbackReply } from '@/lib/feedback-reply'
import { supabase } from '@/lib/supabase'

// Answers waiting for the player, asked for once per launch.
//
// One request, on the intro screen, and nothing keeps it live: a reply is written by hand
// hours or weeks after the message, so the odds of one landing during the minute the app
// happens to be open are not worth a subscription. Next launch is soon enough — it is
// what the dialog promises.
//
// Several answers queue rather than stack: `dismiss` marks the current one seen and the
// next takes its place, oldest first, which is the order the server sends them in.
export function useFeedbackReplies(
  userId: string | null,
  // Auth having settled, either way — `isReady` from `useSupabaseAuth`. Waited for so
  // that `ready` below cannot say "no reply" merely because sign-in has not finished.
  authReady: boolean,
): {
  reply: FeedbackReply | null
  dismiss: () => void
  ready: boolean
} {
  const [queue, setQueue] = useState<readonly FeedbackReply[]>([])
  // The request is a round trip, so `reply: null` means "not yet known" until this flips.
  // The news queues behind it, otherwise it paints first and gets covered a moment later.
  const [ready, setReady] = useState(false)
  // Bumped on every ask and on unmount, so a slow response for a session that has since
  // changed can tell and drop itself — the same guard `useMyMedals` uses.
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!authReady) return

    // Auth settled with nobody signed in — every row here is filed under an `auth.uid()`,
    // so there is no reply to be owed and nothing behind this needs to keep waiting.
    if (userId === null) {
      setReady(true)
      return
    }

    const requestId = ++requestIdRef.current
    void (async () => {
      const res = await supabase.rpc('my_feedback_replies')
      noteRequest(res.error)
      if (requestIdRef.current !== requestId) return
      // A failure is silence: the answer keeps its unseen stamp on the server and comes
      // round again next launch, which is a far better end than an error nobody can act
      // on in front of a dialog that was meant to be a nice surprise.
      setQueue(toReplies(res.data))
      setReady(true)
    })()

    return () => {
      requestIdRef.current++
    }
  }, [userId, authReady])

  const reply = queue[0] ?? null

  const dismiss = useCallback(() => {
    if (reply === null) return
    setQueue((waiting) => waiting.slice(1))
    // Stamped on dismiss rather than on display, so a reply the player never actually
    // read comes back next launch. If this write is the one that fails, the same reply
    // simply shows twice — much the smaller cost of the two.
    void supabase
      .rpc('mark_feedback_reply_seen', { p_id: reply.id })
      .then(({ error }) => {
        noteRequest(error)
      })
  }, [reply])

  return { reply, dismiss, ready }
}

import { isEmptyArray, isOneOf } from 'narrowland'

import { isNetworkFailure, noteRequest } from '@/lib/connectivity'
import { todayISO } from '@/lib/leaderboard-period'
import {
  markPublished,
  noteRefusal,
  pendingOf,
  readLocalScores,
  recordRun,
  writeLocalScores,
  type LocalScore,
} from '@/lib/local-scores'
import { reportRefusal } from '@/lib/refusal'
import { submitSessionScore } from '@/lib/session-board'
import { supabase } from '@/lib/supabase'
import { measureOf, SCORED_MODES, traitsOf, type Difficulty, type ModeId } from '@/modes'

// What Postgres stamps on a bare `raise exception`, which is how every guard in our own
// functions turns a rule down. A refusal carrying it is one we wrote and expected; any
// other code is the database objecting to something we did not plan for.
const RAISED_BY_US = 'P0001'

// How the server answered. `refused` is the one that matters: the write was rejected for
// a reason that was not the connection, so asking again will be rejected again.
type Sent = 'published' | 'offline' | 'refused'

// One write, to the day. `scores` is the best day a player ever had on a board, and the
// server derives it from this row — see the `daily_scores_roll_up` trigger. Writing both
// from here was two chances to fail at something that only ever had one fact in it: a
// submit that reached `scores` but not `daily_scores` left an all-time record no day
// accounted for, and a retired entry made that permanent.
//
// `updated_at` is the moment the run ended, not the moment it was sent. It is what the
// board sorts ties by, so a record that waited out a flight keeps the position it was
// earned in rather than being filed behind everything played since.
// A session run goes somewhere else entirely: `session_scores`, through an RPC that
// checks the window server-side. Routed on the entry rather than on the mode, because
// *which* session a run belonged to is a fact about that run and not about its
// challenge — the same challenge aired twice is two contests.
//
// `userId` is unused here: the RPC writes as `auth.uid()`, so the caller cannot post
// under somebody else's name even by asking.
async function upsertSessionScore(entry: LocalScore, sessionId: string): Promise<Sent> {
  const res = await submitSessionScore({
    sessionId,
    score: entry.score,
    hits: entry.hits,
    difficulty: entry.difficulty,
    achievedAt: entry.achievedAt,
    timeMs: entry.timeMs,
  })
  if (res.sent !== 'refused') return res.sent
  // A window refusal is expected and is not something to log — unlike a board refusal,
  // which never is. The queue still counts it either way, so the entry retires after
  // `MAX_PUBLISH_ATTEMPTS` rather than being offered to a dead contest forever.
  //
  // **Both** directions are expected, not just the shut one: `useSessionCard` reads once
  // per launch and `cardSession` judges liveness by the device's own clock, so a phone
  // running a few minutes fast can start a session the server says has not opened. That
  // is a clock, not a bug.
  //
  // Matched on `P0001` — the SQLSTATE every `raise exception` in our own functions
  // carries — rather than on the sentences, which are copy and will be reworded.
  if (res.error !== null && res.error.code !== RAISED_BY_US) {
    reportRefusal('session_score', res.error, {
      mode: entry.mode,
      difficulty: entry.difficulty,
      day: entry.day,
      score: entry.score,
    })
  }
  return 'refused'
}

async function upsertScore(userId: string, entry: LocalScore): Promise<Sent> {
  const { error } = await supabase.from('daily_scores').upsert(
    {
      user_id: userId,
      mode: entry.mode,
      difficulty: entry.difficulty,
      day: entry.day,
      best_score: entry.score,
      hits: entry.hits,
      updated_at: entry.achievedAt,
    },
    { onConflict: 'user_id,mode,difficulty,day' },
  )
  noteRequest(error)
  if (error === null) return 'published'
  // A retry re-sends the same row, which the server's no-downgrade trigger makes
  // harmless.
  if (isNetworkFailure(error.message)) return 'offline'
  // A refusal is the server rejecting a score the device believes is a new best —
  // never expected, and invisible to the player, so it is exactly what error logging
  // is for.
  reportRefusal('score', error, {
    mode: entry.mode,
    difficulty: entry.difficulty,
    day: entry.day,
    score: entry.score,
  })
  return 'refused'
}

// Where one entry goes. The one place that knows a session run is not a board run, so
// the first attempt and every retry out of the queue cannot disagree about it.
const sendScore = (userId: string, entry: LocalScore): Promise<Sent> =>
  entry.sessionId === undefined
    ? upsertScore(userId, entry)
    : upsertSessionScore(entry, entry.sessionId)

// Applies one send to the store. Publishing clears the entry from the queue; a refusal
// counts against it and eventually retires it; being offline changes nothing, because
// the connection coming back is exactly what makes it worth trying again.
const applySent = (store: LocalScore[], entry: LocalScore, sent: Sent): LocalScore[] => {
  if (sent === 'published') return markPublished(store, entry)
  if (sent === 'refused') return noteRefusal(store, entry)
  return store
}

export async function submitScore(
  userId: string | null,
  nickname: string | null,
  mode: ModeId,
  // The rung the run was **played at**, which is `runRules(...).difficulty` and not
  // whatever the intro last had selected. A mode may pin its own — every challenge so
  // far does — and this is the figure a point is priced by: posting the picked rung
  // instead of the played one weights a challenge's points at half or double what they
  // are worth, on a board and in the fortune alike.
  difficulty: Difficulty,
  score: number,
  hits: number,
  // The session this run belonged to, or null for an ordinary run. A session run is
  // published even though its mode keeps no board — the two bars below are about
  // `scores`, and a session's standings are not that table.
  sessionId: string | null = null,
  // How long the run took, where that is known — `elapsedMs` at game over. Handed in
  // unconditionally and kept only where the mode's **measure** is the clock, which is
  // the whole reason it is decided here: two call sites each asking `measureOf` is two
  // places for a run to post a time its standings cannot use, or to post none where
  // they need one.
  //
  // Undefined from the mid-run record post, which has no finished time to claim.
  elapsedMs?: number,
): Promise<void> {
  // Two bars, and they are different questions. `board` is the mode's own answer to
  // whether it keeps a board at all — practice does not, and neither does a challenge,
  // whose standings belong to the session it was aired in. SCORED_MODES is the *server's*:
  // `scores.mode` carries a `check (mode in ('accuracy', 'speed'))`, so a mode outside
  // the two cannot be published however much it would like a board of its own. A
  // challenge therefore keeps a local best and posts nothing, until that check is
  // widened — see modes/challenges/catalog.ts.
  if (sessionId === null && (!traitsOf(mode).board || !isOneOf(mode, SCORED_MODES))) {
    return
  }
  if (score <= 0) return
  // Only a clock-measured mode keeps one. Everything else — every board run, every
  // score-measured session — stores no time, which is what it has always done.
  const timed = measureOf(mode) === 'time'
  // A race posts once, at the end, or not at all. The mid-run record post has no time,
  // and a timeless entry is judged on its score — so a slower run that scored more
  // replaced the player's faster one, on the device and on the server, and the finish
  // that followed carried a time nothing could compare against. A challenge keeps no
  // `scores` board, so its first point always reads as opening one and always fired it.
  if (timed && elapsedMs === undefined) return
  const timeMs = timed ? elapsedMs : undefined
  const day = todayISO()
  const run = {
    mode,
    difficulty,
    day,
    score,
    hits,
    achievedAt: new Date().toISOString(),
    ...(sessionId === null ? {} : { sessionId }),
    // Spread rather than set, so an ordinary run's entry has no `timeMs` key at all
    // rather than an explicit undefined — which is what `recordRun` reads to tell a
    // timed slot from a scored one, and what the stored shape has always looked like.
    ...(timeMs === undefined ? {} : { timeMs }),
  }

  // Remembered before anything is sent, and regardless of whether sending is even
  // possible. Publishing is what the rest of this does; remembering is not conditional
  // on it, and the next run has to know about this one whatever the network did.
  const before = await readLocalScores()
  const recorded = recordRun(before, run)
  // The run beat nothing the device already holds, so there is nothing new to publish
  // either — the better score is already on its way or already there.
  if (recorded === before) return

  // The slot this run was just recorded into — the session included, or the find would
  // return another airing's entry on a day that held two and publish the wrong score to
  // the wrong standings.
  const entry = recorded.find(
    (other) =>
      other.mode === mode &&
      other.difficulty === difficulty &&
      other.day === day &&
      other.sessionId === (sessionId ?? undefined),
  )
  if (entry === undefined || !userId || !nickname) {
    await writeLocalScores(before, recorded, day)
    return
  }

  const sent = await sendScore(userId, entry)
  await writeLocalScores(before, applySent(recorded, entry, sent), day)
}

// Only one drain runs at a time: the retry ticks and the online signal can both fire
// at once, and a second pass over the same queue would republish what the first is
// already sending.
let flushing = false

// Publishes everything waiting on the device. Called when a nickname first appears — the
// moment the player's local records become publishable — and again on every reconnection
// until nothing is left waiting.
export async function flushPendingScores(
  userId: string,
  nickname: string,
): Promise<void> {
  if (!nickname || flushing) return
  flushing = true
  try {
    const before = await readLocalScores()
    const queue = pendingOf(before)
    if (isEmptyArray(queue)) return

    let next = before
    for (const entry of queue) {
      next = applySent(next, entry, await sendScore(userId, entry))
    }
    // `writeLocalScores` no-ops on an unchanged reference, so a drain that published
    // nothing does not wake the subscribers and feed the next retry.
    await writeLocalScores(before, next, todayISO())
  } finally {
    flushing = false
  }
}

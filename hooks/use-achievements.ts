import { isNonEmptyArray } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ACHIEVEMENT_IDS, type AchievementId } from '@/constants/achievements'
import { useCareer } from '@/hooks/use-career'
import {
  EMPTY_TALLY,
  foldBatch,
  IDLE,
  stepAchievements,
  type AchievementPhase,
  type RunTally,
} from '@/lib/achievement-run'
import {
  addEarned,
  EMPTY_STORE,
  keysOf,
  markSynced,
  mergeEarned,
  readAchievements,
  unsyncedOf,
  writeAchievements,
  type AchievementStore,
} from '@/lib/achievement-store'
import { fetchAchievements, pushAchievements } from '@/lib/achievement-sync'
import {
  awardKey,
  earned,
  holdsBoard,
  type AchievementFacts,
  type Award,
} from '@/lib/achievements'
import type { AnnouncementId } from '@/lib/announcements'
import { boardKey, foldMultiplayer, foldRun, observeHeld } from '@/lib/career'
import { todayISO } from '@/lib/leaderboard-period'
import type { BoardStanding } from '@/lib/medals'
import {
  DIFFICULTY_ORDER,
  MODES,
  SCORED_MODES,
  type Difficulty,
  type HitBatch,
  type Mode,
  type Stats,
} from '@/machines/game'

export type AchievementsInput = {
  inRun: boolean
  // The game-over edge. The final pass runs here — some achievements can only be
  // answered by a run that is over — and the career is folded in straight after.
  finished: boolean
  mode: Mode
  difficulty: Difficulty
  score: number
  hits: number
  lives: number
  maxStreak: number
  strikes: number
  elapsedMs: number
  avgAccuracy: number
  avgSpeed: number
  // Whether this run has beaten the player's own best, from the announcement bar's own
  // reckoning — the one place that already knows.
  personalBest: boolean
  batch: HitBatch
  stats: Stats
  standings: readonly BoardStanding[]
  crown: boolean
  crossed: readonly AnnouncementId[]
  tutorialDone: boolean
  userId: string | null
  // Called with everything a step just unlocked, oldest first. The queue itself lives
  // outside this hook — see `useAchievementQueue` — because the announcement bar has to
  // read it and this hook has to read the bar's own `crossed`, and one of the two had to
  // stop owning the other.
  onUnlocked: (awards: readonly Award[]) => void
}

export type Achievements = {
  // Everything the player holds, in catalogue order — the strip, the list and the count.
  store: AchievementStore
  // Whether the device's copy has been read yet. The strip waits for this rather than
  // showing 0 of 48 for a moment to a player who holds thirty.
  loaded: boolean
  // Everything this run earned, for the game-over screen.
  runEarned: readonly Award[]
  // What the rules are being measured against right now, so the achievements screen can
  // show how far along a locked row is. The same object the run is evaluated with —
  // asking a second way is how a row saying 340/1000 and a bar that just fired would come
  // to disagree.
  facts: AchievementFacts
  // A finished shared run. Its own entry point: a room has no board of its own, sets no
  // personal best and keeps no stats, so all it contributes is that it happened.
  recordMultiplayer: (won: boolean, players: number) => void
}

// How many unlocks one run is allowed to put on the announcement bar.
//
// They are all on the game-over screen anyway, and a player who just unlocked six does
// not want twenty-five seconds of bar instead of their scores. The rest are earned, kept
// and listed — they simply do not each get a parade.
const MAX_ANNOUNCED_PER_RUN = 3

// The achievements: what the player holds, what this run just earned, and what is still
// waiting for its turn on the bar.
//
// All of the deciding lives in `lib/achievements.ts` and `lib/achievement-run.ts` — what
// counts, when to freeze, what has already fired. This hook is what turns those answers
// into a store, a queue and a write.
export function useAchievements(input: AchievementsInput): Achievements {
  const { career, loaded: careerLoaded, update: updateCareer } = useCareer()
  const [store, setStore] = useState<AchievementStore>(EMPTY_STORE)
  const [storeLoaded, setStoreLoaded] = useState(false)
  const [runEarned, setRunEarned] = useState<readonly Award[]>([])

  const phaseRef = useRef<AchievementPhase>(IDLE)
  const tallyRef = useRef<RunTally>(EMPTY_TALLY)
  const batchSeqRef = useRef(-1)
  const announcedRef = useRef(0)
  // Kept current without becoming an effect dependency, so the step effect keys on the
  // run rather than re-running because a parent handed us a new object.
  const inputRef = useRef(input)
  inputRef.current = input
  const storeRef = useRef(store)
  storeRef.current = store
  const careerRef = useRef(career)
  careerRef.current = career
  const onUnlockedRef = useRef(input.onUnlocked)
  onUnlockedRef.current = input.onUnlocked

  // ── The device's copy, then the server's ────────────────────────────────────

  useEffect(() => {
    void (async () => {
      setStore(await readAchievements())
      setStoreLoaded(true)
    })()
  }, [])

  const persist = useCallback((next: AchievementStore) => {
    setStore(next)
    void writeAchievements(next)
  }, [])

  // Reconciliation, once there is a player to ask about. A union either way: nothing is
  // ever revoked, so the only question is who has heard about what.
  useEffect(() => {
    if (!storeLoaded || input.userId === null) return
    const userId = input.userId
    void (async () => {
      const remote = await fetchAchievements(userId)
      // A read that failed is not an empty server. Pushing on the strength of it would be
      // harmless — the table ignores duplicates — but merging on it would not be.
      const merged =
        remote === null ? storeRef.current : mergeEarned(storeRef.current, remote)
      const queued = unsyncedOf(merged)
      if (!isNonEmptyArray(queued)) {
        if (merged !== storeRef.current) persist(merged)
        return
      }
      const sent = await pushAchievements(userId, queued)
      persist(sent ? markSynced(merged) : merged)
    })()
  }, [storeLoaded, input.userId, persist])

  // ── The run ─────────────────────────────────────────────────────────────────

  // Every resolved hit batch, folded once. The tally answers the three things no single
  // snapshot can — the clean stretch, the par hits and the longest route.
  useEffect(() => {
    if (!input.inRun) return
    if (input.batch.seq === batchSeqRef.current) return
    batchSeqRef.current = input.batch.seq
    if (!isNonEmptyArray(input.batch.hits)) return
    tallyRef.current = foldBatch(tallyRef.current, {
      hits: input.batch.hits,
      totalHits: input.hits,
      // Trainee's lives are Infinity, which is never spent, so its whole run is clean.
      livesFull: input.lives >= MODES[input.mode].lives,
    })
  }, [input.inRun, input.batch, input.hits, input.lives, input.mode])

  const evaluate = useCallback(
    (finished: boolean) => {
      const live = inputRef.current
      const step = stepAchievements(phaseRef.current, {
        inRun: live.inRun,
        // Nothing is frozen until the career and the store have both answered. A run that
        // starts first catches up the moment they land — `stepAchievements` measures what
        // the run has already done at the instant it freezes.
        ready: careerLoaded && storeLoaded,
        career: careerRef.current,
        facts: worldFacts(live, tallyRef.current, finished),
        held: keysOf(storeRef.current),
      })
      phaseRef.current = step.phase
      if (!isNonEmptyArray(step.unlocked)) return
      persist(addEarned(storeRef.current, step.unlocked, new Date().toISOString()))
      setRunEarned((held) => [...held, ...step.unlocked])
      const room = Math.max(0, MAX_ANNOUNCED_PER_RUN - announcedRef.current)
      const announce = step.unlocked.slice(0, room)
      announcedRef.current += announce.length
      if (isNonEmptyArray(announce)) onUnlockedRef.current(announce)
    },
    [careerLoaded, storeLoaded, persist],
  )

  // A run resets the per-run bookkeeping the moment it starts, not when the last one
  // ended: the game-over screen is still showing what this run earned while it is up.
  useEffect(() => {
    if (!input.inRun) return
    tallyRef.current = EMPTY_TALLY
    announcedRef.current = 0
    setRunEarned([])
  }, [input.inRun])

  useEffect(() => {
    evaluate(false)
  }, [
    evaluate,
    input.inRun,
    input.score,
    input.hits,
    input.maxStreak,
    input.batch,
    input.stats,
    input.standings,
    input.crown,
    input.crossed,
    input.tutorialDone,
  ])

  // The finished pass, then the fold — in that order. The rules read the career as it
  // stood *before* the run and add the run themselves, so folding first would count every
  // hit twice.
  const wasFinishedRef = useRef(false)
  useEffect(() => {
    if (input.finished === wasFinishedRef.current) return
    wasFinishedRef.current = input.finished
    if (!input.finished) return
    evaluate(true)
    const live = inputRef.current
    updateCareer((current) =>
      foldRun(current, {
        mode: live.mode,
        difficulty: live.difficulty,
        score: live.score,
        hits: live.hits,
        strikes: live.strikes,
        maxStreak: live.maxStreak,
        parHits: tallyRef.current.parHits,
        cleanHits: tallyRef.current.cleanHits,
        elapsedMs: live.elapsedMs,
        day: todayISO(),
        personalBest: live.personalBest,
      }),
    )
  }, [input.finished, evaluate, updateCareer])

  // ── Which boards the player is holding ──────────────────────────────────────

  // Watched rather than asked at the moment it matters: "held it for seven days" needs a
  // start, and the boards are the only thing that knows the player is on top of one.
  useEffect(() => {
    if (!careerLoaded) return
    const facts = worldFacts(inputRef.current, tallyRef.current, false)
    const held = SCORED_MODES.flatMap((mode) =>
      DIFFICULTY_ORDER.filter((difficulty) =>
        holdsBoard({ ...facts, career: careerRef.current }, mode, difficulty),
      ).map((difficulty) => boardKey(mode, difficulty)),
    )
    const now = new Date().toISOString()
    updateCareer((current) => {
      const next = observeHeld(current, held, now)
      // `observeHeld` rebuilds the map every time, so compare rather than trusting
      // identity — otherwise every board refresh would be a write.
      const same =
        Object.keys(next.heldSince).length === Object.keys(current.heldSince).length &&
        Object.entries(next.heldSince).every(([key, at]) => current.heldSince[key] === at)
      return same ? current : next
    })
  }, [careerLoaded, input.standings, updateCareer])

  // Between runs, everything is settled quietly: earned, stored, counted on the strip —
  // but never announced.
  //
  // This is what makes the score ladders retroactive. A player who has been at this for
  // months holds a dozen of these the first time the build runs, and a dozen unlocks
  // parading across the bar of their next run would be a worse welcome than a strip that
  // simply already says 14/48. It is also where a shared run's achievements land, since a
  // room is not a run of the machine's and never freezes a career.
  useEffect(() => {
    if (input.inRun || !careerLoaded || !storeLoaded) return
    const facts = worldFacts(inputRef.current, tallyRef.current, false)
    const all = earned({ ...facts, career: careerRef.current })
    const next = addEarned(storeRef.current, all, new Date().toISOString())
    if (next !== storeRef.current) persist(next)
  }, [
    input.inRun,
    careerLoaded,
    storeLoaded,
    career,
    input.stats,
    input.standings,
    input.crown,
    input.tutorialDone,
    persist,
  ])

  const recordMultiplayer = useCallback(
    (won: boolean, players: number) => {
      updateCareer((current) => foldMultiplayer(current, { won, players }))
    },
    [updateCareer],
  )

  // Dev-only escape hatch: grant, or clear, from the console rather than by playing.
  useEffect(() => {
    if (!__DEV__) return
    Object.assign(globalThis, {
      nineEarn: (id: AchievementId, stage: Difficulty | null = null) => {
        const award = { id, stage }
        persist(addEarned(storeRef.current, [award], new Date().toISOString()))
        onUnlockedRef.current([award])
      },
      nineClearAchievements: () => {
        persist(EMPTY_STORE)
      },
      nineAchievementIds: [...ACHIEVEMENT_IDS],
    })
  }, [persist])

  return {
    store,
    loaded: storeLoaded,
    runEarned,
    facts: { ...worldFacts(input, tallyRef.current, false), career },
    recordMultiplayer,
  }
}

// The unlocks still waiting for their turn on the announcement bar.
//
// Its own hook, and owned above both of the two that need it: `useAnnouncements` has to
// read the queue, and `useAchievements` has to read the bar's own `crossed` to answer the
// board-shaped achievements. Neither can be declared after the other, so the one thing
// they share is declared before both.
//
// Cleared as a run starts rather than as one ends — the game-over screen is still up, and
// anything left over belongs to the run the player is looking at.
export function useAchievementQueue(inRun: boolean): {
  queue: readonly Award[]
  push: (awards: readonly Award[]) => void
  announced: (award: Award) => void
} {
  const [queue, setQueue] = useState<readonly Award[]>([])

  useEffect(() => {
    if (inRun) setQueue([])
  }, [inRun])

  const push = useCallback((awards: readonly Award[]) => {
    setQueue((held) => [...held, ...awards])
  }, [])

  const announced = useCallback((award: Award) => {
    const key = awardKey(award)
    setQueue((held) => held.filter((queued) => awardKey(queued) !== key))
  }, [])

  return { queue, push, announced }
}

// Everything the rules ask about except the career, which the phase owns.
const worldFacts = (
  input: AchievementsInput,
  tally: RunTally,
  finished: boolean,
): Omit<AchievementFacts, 'career'> => ({
  stats: input.stats,
  run: {
    mode: input.mode,
    difficulty: input.difficulty,
    score: input.score,
    hits: input.hits,
    maxStreak: input.maxStreak,
    cleanHits: tally.cleanHits,
    parHits: tally.parHits,
    longestRoute: tally.longestRoute,
    elapsedMs: input.elapsedMs,
    avgAccuracy: input.avgAccuracy,
    avgSpeed: input.avgSpeed,
    personalBest: input.personalBest,
    finished,
    endedAt: new Date(),
  },
  standings: input.standings,
  crown: input.crown,
  crossed: input.crossed,
  tutorialDone: input.tutorialDone,
  now: new Date(),
})

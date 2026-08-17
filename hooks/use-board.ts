import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useLocalScores } from '@/hooks/use-local-scores'
import { subscribeBoards } from '@/lib/board-live'
import {
  fetchMyRank,
  fetchTop5,
  type LeaderboardRow,
  type LeaderboardTab,
  type MyRankRow,
} from '@/lib/leaderboard'
import { msUntilNextDay, todayISO } from '@/lib/leaderboard-period'
import { bestFor, bestPending } from '@/lib/local-scores'
import type { Difficulty, Mode } from '@/machines/game'

// One submit writes to `scores` and `daily_scores` at once, so every score arrives as
// two events. Long enough to answer both with a single fetch, short enough that a board
// still reads as live.
const COALESCE_MS = 300

const TABS = ['today', 'week', 'forever'] as const satisfies readonly [
  LeaderboardTab,
  ...LeaderboardTab[],
]

// One period of one board (mode × difficulty), as everything on screen sees it.
export type PeriodBoard = {
  rows: LeaderboardRow[]
  myRank: MyRankRow | null
  loading: boolean
  error: string | null
  // The score at the top, or null when the board is empty or could not be read. An
  // unknown record cannot be beaten, which is why the two share a value.
  record: number | null
  // Whether that record is the player's own. False on a board with no record at all,
  // so nothing has to check for both.
  recordIsMine: boolean
  // Known to hold no score at all — the request came back and brought nothing. False
  // whenever we could not find out, so a board we failed to read is never mistaken for
  // an empty one.
  empty: boolean
  // The player's best here from every source, server and device alike. Zero when they
  // have nothing on this board.
  myBest: number
  // What the device holds that the server does not, or null when they agree. This is
  // the only thing that earns the unpublished mark on the board.
  unpublished: number | null
}

export type Board = {
  today: PeriodBoard
  week: PeriodBoard
  forever: PeriodBoard
  // True once the first fetch for this board has settled, however it went. Callers wait
  // on this to know the numbers are as good as they are going to get — not that they
  // are non-null.
  loaded: boolean
  refresh: () => Promise<void>
}

type Fetched = {
  rows: LeaderboardRow[]
  myRank: MyRankRow | null
  loading: boolean
  error: string | null
}

type FetchedByTab = Record<LeaderboardTab, Fetched>

const LOADING: Fetched = { rows: [], myRank: null, loading: true, error: null }
const EMPTY: Fetched = { rows: [], myRank: null, loading: false, error: null }

const ALL_LOADING: FetchedByTab = { today: LOADING, week: LOADING, forever: LOADING }

const NO_PERIOD: PeriodBoard = {
  ...EMPTY,
  record: null,
  recordIsMine: false,
  empty: false,
  myBest: 0,
  unpublished: null,
}

// A board with nothing on it and nothing to say: what Trainee has, and what a consumer
// rendered outside the provider sees instead of a crash. Every flag is the quiet
// answer, so nothing downstream needs a special case for "there is no board here".
const NO_BOARD: Board = {
  today: NO_PERIOD,
  week: NO_PERIOD,
  forever: NO_PERIOD,
  loaded: true,
  refresh: () => Promise.resolve(),
}

async function loadTab(
  mode: Mode,
  difficulty: Difficulty,
  tab: LeaderboardTab,
  userId: string | null,
): Promise<Fetched> {
  const [top5, myRankRes] = await Promise.all([
    fetchTop5(mode, difficulty, tab),
    userId
      ? fetchMyRank(userId, mode, difficulty, tab)
      : Promise.resolve({ row: null, error: null }),
  ])
  const error = top5.error ?? myRankRes.error
  if (error !== null) return { rows: [], myRank: null, loading: false, error }
  return { rows: top5.rows, myRank: myRankRes.row, loading: false, error: null }
}

const rowFor = (
  rows: LeaderboardRow[],
  userId: string | null,
): LeaderboardRow | undefined =>
  userId === null ? undefined : rows.find((row) => row.user_id === userId)

// Folds the device's own memory into one fetched period. The server is the authority on
// who leads; the device is the authority on what the player scored, because a score
// reaches the device before it reaches the board and stays there when it cannot be
// published at all. Derived on every render rather than patched into the fetched state,
// so a new run shows the instant it is recorded and there is nothing to invalidate.
//
// The two local numbers are different questions. `local` is everything the device
// remembers scoring here and answers "what is my best"; `waiting` is only what has yet
// to reach the server and answers "what is not on the board yet". A score the server
// refused for good counts towards the first and not the second — it happened, but
// marking it as on its way would be a promise the app cannot keep.
function toPeriod(
  fetched: Fetched,
  userId: string | null,
  local: number | null,
  waiting: number | null,
): PeriodBoard {
  const myRow = rowFor(fetched.rows, userId)
  const serverBest = Math.max(fetched.myRank?.best_score ?? 0, myRow?.best_score ?? 0)
  const unpublished = waiting !== null && waiting > serverBest ? waiting : null
  const top = fetched.rows[0]
  return {
    ...fetched,
    record: top?.best_score ?? null,
    recordIsMine: top !== undefined && userId !== null && top.user_id === userId,
    empty: fetched.error === null && !fetched.loading && fetched.rows.length === 0,
    myBest: Math.max(serverBest, local ?? 0),
    unpublished,
  }
}

// The one board store. Held once for the whole app and read by every surface, so the
// intro, the pause screen, the game over screen and the strip above the dial can no
// longer answer the same question differently.
//
// `nine.stats` deliberately plays no part here. It is an all-time number with no date and
// no matching entry in the local store, so it can never publish — showing it on a board
// would mark a score as waiting to sync that nothing will ever send. It also climbs
// *during* a run, which put the score in progress on the all-time board. The local store
// keeps its own best per board of all time (see pruneLocalScores), and that one is a real
// record with a real day behind it.
export function useBoard(
  mode: Mode,
  difficulty: Difficulty,
  userId: string | null,
): Board {
  const [fetched, setFetched] = useState<FetchedByTab>(ALL_LOADING)
  const [loaded, setLoaded] = useState(false)
  // Bumped when the day boards roll over, both to re-run the timer and to re-read the
  // clock the local windows are measured against.
  const [dayEpoch, setDayEpoch] = useState(0)

  const abortedRef = useRef(false)
  const hasDataRef = useRef(false)

  const localScores = useLocalScores()

  // `showLoading` = true on first load (show skeletons), false on a Realtime-triggered
  // or scheduled re-fetch, so a background refresh never flickers the UI.
  const fetchAll = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setFetched(ALL_LOADING)
        setLoaded(false)
        hasDataRef.current = false
      }

      const [today, week, forever] = await Promise.all(
        TABS.map((tab) => loadTab(mode, difficulty, tab, userId)),
      )
      if (abortedRef.current) return
      if (today === undefined || week === undefined || forever === undefined) return

      setLoaded(true)
      // A silent failure when we already have rows keeps the last good ones: the player
      // cannot tell a board that failed to load from one that emptied, so blanking it
      // would be the worse lie. A successful fetch always wins, empty result included —
      // that is what lets a board clear when the day rolls over.
      const anyError = today.error ?? week.error ?? forever.error
      if (anyError === null) {
        hasDataRef.current = true
        setFetched({ today, week, forever })
        return
      }
      if (!hasDataRef.current) setFetched({ today, week, forever })
    },
    [mode, difficulty, userId],
  )

  // Stable ref so the Realtime callback and the rollover timer always reach the latest
  // fetchAll without tearing the channel down on every render.
  const fetchAllRef = useRef(fetchAll)
  fetchAllRef.current = fetchAll

  useEffect(() => {
    if (mode === 'trainee') return

    abortedRef.current = false
    hasDataRef.current = false
    void fetchAll(true)

    // The app's one live connection tells us when any board moves; this is the board we
    // are showing, so everything else passes. A null move is a gap we cannot see into —
    // a reconnection, or a row we could not attribute — and the safe reading is that
    // this board may have changed too.
    //
    // The event is only a nudge. Its payload is never trusted; the refetch it triggers
    // is what says what the board holds.
    let coalesce: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeBoards((moved) => {
      if (moved !== null && (moved.mode !== mode || moved.difficulty !== difficulty)) {
        return
      }
      clearTimeout(coalesce)
      coalesce = setTimeout(() => void fetchAllRef.current(false), COALESCE_MS)
    })

    return () => {
      abortedRef.current = true
      clearTimeout(coalesce)
      unsubscribe()
    }
  }, [mode, difficulty, userId, fetchAll])

  // The day boards empty on the Prague clock and nothing else would notice: Realtime
  // fires only when a score moves, so a board sitting open at midnight would keep
  // yesterday's rows until one did. Re-armed after each rollover.
  useEffect(() => {
    if (mode === 'trainee') return
    const timer = setTimeout(() => {
      setDayEpoch((epoch) => epoch + 1)
      void fetchAllRef.current(false)
    }, msUntilNextDay())
    return () => {
      clearTimeout(timer)
    }
  }, [mode, dayEpoch])

  const refresh = useCallback(async () => {
    if (mode === 'trainee') return
    await fetchAll(false)
  }, [mode, fetchAll])

  // Bumping `dayEpoch` re-renders, which is what re-reads the clock here: the local
  // windows have to move to the new day at the same moment the boards do.
  const today = todayISO()

  // Memoised so the boards are not rebuilt on every render of the game screen, which
  // ticks on every hit — every consumer of the context reads this object.
  return useMemo(() => {
    if (mode === 'trainee') return { ...NO_BOARD, refresh }
    const period = (tab: LeaderboardTab): PeriodBoard =>
      toPeriod(
        fetched[tab],
        userId,
        bestFor(localScores, mode, difficulty, tab, today),
        bestPending(localScores, mode, difficulty, tab, today),
      )
    return {
      today: period('today'),
      week: period('week'),
      forever: period('forever'),
      loaded,
      refresh,
    }
  }, [mode, difficulty, userId, fetched, localScores, today, loaded, refresh])
}

const BoardContext = createContext<Board>(NO_BOARD)

export const BoardProvider = BoardContext.Provider

export const useBoardContext = (): Board => use(BoardContext)

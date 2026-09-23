import { GAME_SCALE } from '@/constants/colors'
import {
  BOARDS,
  DAYS,
  seeded,
  simulateWeek,
  type Board,
  type PoolKey,
  type WeekFacts,
} from '@/dev/weekly-recap/facts'
import {
  boardLine,
  headline,
  name,
  recordLine,
  type Segment,
  type Sentence,
} from '@/dev/weekly-recap/lines'
import { DIFFICULTY_ORDER, SCORED_MODES } from '@/machines/game'
import { getDifficultyColor } from '@/machines/modes'

// Facts to shape to prose — the three steps of the design, as pure functions.

// Hardest first, which is what a tie turns on. The same ordering `lib/medals.ts` already
// encodes in `isBetter`: difficulty decides, and the mode settles what is left. Repeated
// here rather than imported because this is a prototype and that function takes a Medal;
// shipping it means calling the real one instead.
const boardWeight = (board: Board): number =>
  -DIFFICULTY_ORDER.indexOf(board.difficulty) * 10 + SCORED_MODES.indexOf(board.mode)

export type DayWinner = { nickname: string; boards: number }

// A day belongs to whoever topped the most boards on it. Scores across boards are not
// comparable — a Speed Extreme number and an Accuracy Easy number mean nothing beside
// each other — so the count of boards is the only honest currency, and the hardest board
// held breaks the ties it leaves.
export function dayWinners(facts: WeekFacts): readonly (DayWinner | null)[] {
  return DAYS.map((_, dayIndex) => {
    const counts = new Map<string, number>()
    const hardest = new Map<string, number>()

    BOARDS.forEach((board, boardIndex) => {
      const who = facts.cells[dayIndex]?.[boardIndex] ?? null
      if (who === null) return
      counts.set(who, (counts.get(who) ?? 0) + 1)
      const weight = boardWeight(board)
      const held = hardest.get(who)
      if (held === undefined || weight < held) hardest.set(who, weight)
    })

    let best: DayWinner | null = null
    for (const [nickname, boards] of counts) {
      if (best === null || boards > best.boards) {
        best = { nickname, boards }
        continue
      }
      if (boards < best.boards) continue
      const challenger = hardest.get(nickname) ?? 0
      const holder = hardest.get(best.nickname) ?? 0
      if (challenger < holder) best = { nickname, boards }
    }
    return best
  })
}

export type ShapeKind = 'empty' | 'quiet' | 'sweep' | 'sweepBut' | 'split' | 'scattered'

type Exception = { day: string; nickname: string }

export type WeekShape = {
  kind: ShapeKind
  playedDays: readonly number[]
  ranked: readonly { nickname: string; days: number }[]
  exceptions: readonly Exception[]
}

// Below this, a week has too little in it to describe as a contest.
const QUIET_MAX_DAYS = 3
// "Every day but Thursday" survives one more exception before it stops being that
// sentence and starts being a list.
const SWEEP_BUT_MAX_EXCEPTIONS = 2
// Three names is a spread; two is still a duel.
const SPLIT_PLAYERS = 2

// Grouping the days by winner before any phrasing happens is the whole trick. It is what
// turns seven separate results into "every day except Thursday" — a sentence no amount of
// per-day templating can reach, because the exception only exists once the group does.
export function weekShape(winners: readonly (DayWinner | null)[]): WeekShape {
  const playedDays = winners.flatMap((winner, index) => (winner === null ? [] : [index]))

  const tally = new Map<string, number>()
  for (const index of playedDays) {
    const winner = winners[index]
    if (winner === undefined || winner === null) continue
    tally.set(winner.nickname, (tally.get(winner.nickname) ?? 0) + 1)
  }

  const ranked = [...tally.entries()]
    .map(([nickname, days]) => ({ nickname, days }))
    .sort((a, b) => b.days - a.days)

  const top = ranked[0]
  const base = { playedDays, ranked, exceptions: [] }
  if (top === undefined) return { ...base, kind: 'empty' }
  if (playedDays.length <= QUIET_MAX_DAYS) return { ...base, kind: 'quiet' }
  if (ranked.length === 1) return { ...base, kind: 'sweep' }

  const exceptions = playedDays.flatMap((index) => {
    const winner = winners[index]
    if (winner === undefined || winner === null) return []
    if (winner.nickname === top.nickname) return []
    return [{ day: DAYS[index] ?? '', nickname: winner.nickname }]
  })

  if (exceptions.length <= SWEEP_BUT_MAX_EXCEPTIONS) {
    return { ...base, kind: 'sweepBut', exceptions }
  }
  if (ranked.length === SPLIT_PLAYERS) return { ...base, kind: 'split' }
  return { ...base, kind: 'scattered' }
}

type BoardStory =
  | { kind: 'owned'; board: Board; nickname: string }
  | { kind: 'ownedBut'; board: Board; nickname: string; day: string; other: string }
  | { kind: 'contested'; board: Board; players: number }

// A board nobody really played has no story in it.
const MIN_BOARD_DAYS = 4
const CONTESTED_MIN_PLAYERS = 4

// The middle sentence: one board worth naming, because the headline speaks for the week
// and a recap that only ever speaks for the week says the same thing every Monday.
//
// `ownedBut` is preferred over `owned` — a board held all week except once has two names
// in it and a moment to point at, where a board held outright has neither.
const STORY_PRIORITY = {
  ownedBut: 0,
  owned: 1,
  contested: 2,
} as const satisfies Record<BoardStory['kind'], number>

function boardStory(facts: WeekFacts): BoardStory | null {
  const stories = BOARDS.flatMap<BoardStory>((board, boardIndex) => {
    const held = DAYS.flatMap((_, dayIndex) => {
      const who = facts.cells[dayIndex]?.[boardIndex] ?? null
      return who === null ? [] : [{ dayIndex, who }]
    })
    if (held.length < MIN_BOARD_DAYS) return []

    const tally = new Map<string, number>()
    for (const day of held) tally.set(day.who, (tally.get(day.who) ?? 0) + 1)
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])

    const top = ranked[0]
    if (top === undefined) return []
    const [leader, days] = top

    if (days === held.length) return [{ kind: 'owned', board, nickname: leader }]

    if (held.length - days === 1) {
      const odd = held.find((day) => day.who !== leader)
      if (odd === undefined) return []
      return [
        {
          kind: 'ownedBut',
          board,
          nickname: leader,
          day: DAYS[odd.dayIndex] ?? '',
          other: odd.who,
        },
      ]
    }

    if (ranked.length >= CONTESTED_MIN_PLAYERS) {
      return [{ kind: 'contested', board, players: ranked.length }]
    }
    return []
  })

  return (
    [...stories].sort(
      (a, b) =>
        STORY_PRIORITY[a.kind] - STORY_PRIORITY[b.kind] ||
        boardWeight(a.board) - boardWeight(b.board),
    )[0] ?? null
  )
}

const boardText = (board: Board): string =>
  `${board.mode.toUpperCase()} · ${board.difficulty.toUpperCase()}`

// A board wears its own colour in the prose — the mode's gradient read at its
// difficulty, which is the app's existing rule for what a board looks like.
const boardSegment = (board: Board, text: string): Segment => ({
  text,
  kind: 'board',
  color: getDifficultyColor(board.mode, board.difficulty),
})

export type Recap = {
  sentences: readonly Sentence[]
  shape: WeekShape
  winners: readonly (DayWinner | null)[]
}

function opener(random: () => number, shape: WeekShape): Sentence {
  const top = shape.ranked[0]
  if (shape.kind === 'empty' || top === undefined) return headline(random, 'empty', {})
  const leader = name(top.nickname)

  if (shape.kind === 'quiet') {
    const days = String(shape.playedDays.length)
    if (top.days === shape.playedDays.length) {
      return headline(random, 'quietSweep', { A: leader, P: days })
    }
    return headline(random, 'quiet', { A: leader, N: String(top.days), P: days })
  }
  if (shape.kind === 'sweep') return headline(random, 'sweep', { A: leader })

  if (shape.kind === 'sweepBut') {
    const [first, second] = shape.exceptions
    if (first === undefined) return headline(random, 'sweep', { A: leader })
    if (second === undefined) {
      return headline(random, 'sweepBut1', {
        A: leader,
        B: name(first.nickname),
        D: first.day,
      })
    }
    return headline(random, 'sweepBut2', { A: leader, D: first.day, E: second.day })
  }

  if (shape.kind === 'split') {
    const runnerUp = shape.ranked[1]
    if (runnerUp === undefined) return headline(random, 'sweep', { A: leader })
    return headline(random, 'split', {
      A: leader,
      B: name(runnerUp.nickname),
      N: String(top.days),
      M: String(runnerUp.days),
    })
  }

  return headline(random, 'scattered', {
    A: leader,
    N: String(top.days),
    C: String(shape.ranked.length),
    P: String(shape.playedDays.length),
  })
}

// `leader` is the player the headline just credited with the week, or null when the week
// had no clear one. It decides whether the board sentence agrees with the opener or has
// to be set against it.
function middle(
  random: () => number,
  facts: WeekFacts,
  leader: string | null,
): Sentence | null {
  const story = boardStory(facts)
  if (story === null) return null

  const elsewhere = leader !== null && 'nickname' in story && story.nickname !== leader
  // A board somebody else held outright is the best counterpoint the week has, so it is
  // kept and reframed. A board they merely held *most* of is not worth spending the
  // sentence on when the opener has already named a different winner — and "stayed
  // theirs" would be overclaiming a board they lost a day of.
  if (elsewhere && story.kind === 'ownedBut') return null
  if (elsewhere && story.kind === 'owned') {
    return boardLine(random, 'counterpoint', {
      BOARD: boardSegment(story.board, boardText(story.board)),
      W: name(story.nickname),
    })
  }
  const board = boardSegment(story.board, boardText(story.board))
  const mode = boardSegment(story.board, story.board.mode.toUpperCase())

  if (story.kind === 'contested') {
    return boardLine(random, 'contested', { BOARD: board, C: String(story.players) })
  }
  if (story.kind === 'owned') {
    return boardLine(random, 'owned', {
      BOARD: board,
      MODE: mode,
      W: name(story.nickname),
    })
  }
  return boardLine(random, 'ownedBut', {
    BOARD: board,
    MODE: mode,
    W: name(story.nickname),
    D: story.day,
    O: name(story.other),
  })
}

function closer(random: () => number, facts: WeekFacts): Sentence {
  const [only] = facts.records
  if (only === undefined) return recordLine(random, 'none', {})
  if (facts.records.length > 1) {
    return recordLine(random, 'many', { C: String(facts.records.length) })
  }
  return recordLine(random, 'one', {
    BOARD: { text: boardText(only.board), kind: 'record' },
    D: DAYS[only.dayIndex] ?? '',
    W: name(only.nickname),
  })
}

// Names are coloured per recap, in order of first appearance, so no two people in one
// paragraph ever share a colour — which is the only promise colour has to keep here.
//
// A per-player hash was tried first and is worse than it looks: on the real five-name
// roster it put three of them on the same amber, and the paragraph where that matters
// most is exactly the one naming two players at once. Appearance order has a second
// virtue — the week's leader opens the recap, so the protagonist is always the same blue.
function colourNames(sentences: readonly Sentence[]): readonly Sentence[] {
  const palette = new Map<string, string>()
  for (const sentence of sentences) {
    for (const segment of sentence) {
      if (segment.kind !== 'name' || palette.has(segment.text)) continue
      palette.set(
        segment.text,
        GAME_SCALE[palette.size % GAME_SCALE.length] ?? GAME_SCALE[0],
      )
    }
  }
  return sentences.map((sentence) =>
    sentence.map((segment) =>
      segment.kind === 'name'
        ? { ...segment, color: palette.get(segment.text) ?? GAME_SCALE[0] }
        : segment,
    ),
  )
}

export function composeRecap(facts: WeekFacts, phraseSeed: string): Recap {
  const random = seeded(phraseSeed)
  const winners = dayWinners(facts)
  const shape = weekShape(winners)

  const sentences = [opener(random, shape)]
  // Only a week with one name on it has a leader to set a board against; a split or a
  // scattered week has already said that nobody owned it.
  const hasLeader = shape.kind === 'sweep' || shape.kind === 'sweepBut'
  const board = middle(
    random,
    facts,
    hasLeader ? (shape.ranked[0]?.nickname ?? null) : null,
  )
  if (board !== null) sentences.push(board)
  // A week nobody played has said everything it has to say. "Nothing all-time moved"
  // after "nobody played" is the same sentence twice.
  if (shape.kind !== 'empty') sentences.push(closer(random, facts))

  return { sentences: colourNames(sentences), shape, winners }
}

// Which population reaches which shape. Shape is decided almost entirely by who is
// playing: `scattered` needs a crowd, and `quiet` only happens when the game is nearly
// asleep — across six boards at any ordinary play rate, somebody tops a board every day.
const SHAPE_POOL = {
  empty: 'sparse',
  quiet: 'sparse',
  sweep: 'small',
  sweepBut: 'small',
  split: 'small',
  scattered: 'busy',
} as const satisfies Record<ShapeKind, PoolKey>

const SEARCH_LIMIT = 800

// A week of the requested shape, found by rolling seeds rather than hand-authored, so
// what the gallery shows is a week the simulation could actually produce.
export function weekForShape(kind: ShapeKind, salt: string): WeekFacts | null {
  const poolKey = SHAPE_POOL[kind]
  for (let attempt = 0; attempt < SEARCH_LIMIT; attempt++) {
    const facts = simulateWeek(`${salt}:${attempt}`, poolKey)
    if (weekShape(dayWinners(facts)).kind === kind) return facts
  }
  return null
}

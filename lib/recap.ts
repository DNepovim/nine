import { msg } from '@lingui/core/macro'
import { isOneOf } from 'narrowland'

import { GAME_SCALE } from '@/constants/colors'
import { isDifficulty } from '@/lib/is-difficulty'
import { nextDay } from '@/lib/leaderboard-period'
import { boardClaim } from '@/lib/medals'
import { MONTHS, type Segment, type Sentence, type Translate } from '@/lib/prose'
import { boardLine, headline, name, takeoverLine, WEEKDAYS } from '@/lib/recap-lines'
import { idSeed, seeded, type Rng } from '@/lib/rng'
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getDifficultyColor,
  labelOf,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/modes'

// A week on the boards, turned into the two or three sentences the launch popup tells it
// in. Facts to shape to prose, as pure functions.
//
// Pure in every argument, including the language: the same week, told on the same Monday,
// in the same locale, is always the same paragraph. That is not tidiness — a player who
// dismisses the dialog and opens it again must be told the week in the words they were told
// it in a moment ago, and a recap that re-rolled on each render would be a different week
// every time they looked.

// One leaderboard: a mode and a difficulty.
export type Board = { mode: ScoredMode; difficulty: Difficulty }

// The six scored boards, hardest last within each mode — the order the grid reads in.
export const BOARDS: readonly Board[] = SCORED_MODES.flatMap((mode) =>
  DIFFICULTY_ORDER.map((difficulty) => ({ mode, difficulty })),
)

// Monday to Sunday. A recap only ever describes a week that has closed.
export const DAY_COUNT = 7

// An all-time board that changed hands inside the window. **Takeover**, not record: a
// record in this app is a score crossing a bar mid-run and then gone, and the podium
// standing this actually is would be a medal. The player-facing copy still says record,
// because that is the word a player uses — see lib/recap-lines.ts.
export type Takeover = {
  board: Board
  boardIndex: number
  dayIndex: number
  nickname: string
}

// One week. `cells[dayIndex][boardIndex]` is the nickname that topped that board that day,
// or null where nobody played it.
export type WeekFacts = {
  cells: readonly (readonly (string | null)[])[]
  takeovers: readonly Takeover[]
}

// ─── The rows, as facts ─────────────────────────────────────────────────────────────────

// What `weekly_recap` returns, before anything has been checked.
export type RecapRow = {
  kind: string
  mode: string
  difficulty: string
  day: string
  nickname: string
}

const RECAP_KINDS = ['cell', 'takeover'] as const

const boardIndexOf = (mode: ScoredMode, difficulty: Difficulty): number =>
  BOARDS.findIndex((board) => board.mode === mode && board.difficulty === difficulty)

// The seven days of the window, as ISO days, so a row's date becomes its index by lookup
// rather than by arithmetic. Stepping with `nextDay` keeps this on the one definition of
// what tomorrow is that the rest of the app already uses.
const daysFrom = (from: string): readonly string[] => {
  const days = [from]
  for (let i = 1; i < DAY_COUNT; i++) {
    const previous = days[i - 1]
    if (previous === undefined) break
    days.push(nextDay(previous))
  }
  return days
}

// Rows to a week.
//
// Validated on the way in the way every other board read is: the database has no idea what
// a `ScoredMode` is, so a row naming a mode, a difficulty, a kind or a day this build does
// not recognise is dropped rather than trusted. A device can be older than the server.
export function factsFromRows(rows: readonly RecapRow[], from: string): WeekFacts {
  const days = daysFrom(from)
  const cells: (string | null)[][] = days.map(() => BOARDS.map(() => null))
  const takeovers: Takeover[] = []

  for (const row of rows) {
    if (!isOneOf(row.kind, RECAP_KINDS)) continue
    if (!isOneOf(row.mode, SCORED_MODES)) continue
    if (!isDifficulty(row.difficulty)) continue

    const dayIndex = days.indexOf(row.day)
    if (dayIndex < 0) continue
    const boardIndex = boardIndexOf(row.mode, row.difficulty)
    if (boardIndex < 0) continue

    if (row.kind === 'cell') {
      const day = cells[dayIndex]
      if (day === undefined) continue
      day[boardIndex] = row.nickname
      continue
    }
    takeovers.push({
      board: { mode: row.mode, difficulty: row.difficulty },
      boardIndex,
      dayIndex,
      nickname: row.nickname,
    })
  }

  return { cells, takeovers }
}

// Whether anybody topped anything all week.
//
// What the hook asks before it opens a dialog. "Nobody played" is not news to the person
// who also did not play, so an empty week advances the marker and says nothing — and the
// decision lives there rather than here, so that the gallery can still look at the
// paragraph an empty week would have been told in.
export const hasAnyWinner = (facts: WeekFacts): boolean =>
  facts.cells.some((day) => day.some((who) => who !== null))

// ─── Facts to shape ─────────────────────────────────────────────────────────────────────

export type DayWinner = { nickname: string; boards: number }

// A day belongs to whoever topped the most boards on it. Scores across boards are not
// comparable — a Speed Extreme number and an Accuracy Easy number mean nothing beside each
// other — so the count of boards is the only honest currency, and the hardest board held
// breaks the ties it leaves.
export function dayWinners(facts: WeekFacts): readonly (DayWinner | null)[] {
  return facts.cells.map((day) => {
    const counts = new Map<string, number>()
    const hardest = new Map<string, number>()

    BOARDS.forEach((board, boardIndex) => {
      const who = day[boardIndex] ?? null
      if (who === null) return
      counts.set(who, (counts.get(who) ?? 0) + 1)
      const weight = boardClaim(board.mode, board.difficulty)
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

type Exception = { dayIndex: number; nickname: string }

export type WeekShape = {
  kind: ShapeKind
  playedDays: readonly number[]
  ranked: readonly { nickname: string; days: number }[]
  exceptions: readonly Exception[]
}

// Below this, a week has too little in it to describe as a contest.
const QUIET_MAX_DAYS = 3
// "Every day but Thursday" survives one more exception before it stops being that sentence
// and starts being a list.
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
    return [{ dayIndex: index, nickname: winner.nickname }]
  })

  if (exceptions.length <= SWEEP_BUT_MAX_EXCEPTIONS) {
    return { ...base, kind: 'sweepBut', exceptions }
  }
  if (ranked.length === SPLIT_PLAYERS) return { ...base, kind: 'split' }
  return { ...base, kind: 'scattered' }
}

type BoardStory =
  | { kind: 'owned'; board: Board; nickname: string }
  | { kind: 'ownedBut'; board: Board; nickname: string; dayIndex: number; other: string }
  | { kind: 'contested'; board: Board; players: number }

// A board nobody really played has no story in it.
const MIN_BOARD_DAYS = 4
const CONTESTED_MIN_PLAYERS = 4

// The middle sentence: one board worth naming, because the headline speaks for the week and
// a recap that only ever speaks for the week says the same thing every Monday.
//
// `ownedBut` is preferred over `owned` — a board held all week except once has two names in
// it and a moment to point at, where a board held outright has neither.
const STORY_PRIORITY = {
  ownedBut: 0,
  owned: 1,
  contested: 2,
} as const satisfies Record<BoardStory['kind'], number>

function boardStory(facts: WeekFacts): BoardStory | null {
  const stories = BOARDS.flatMap<BoardStory>((board, boardIndex) => {
    const held = facts.cells.flatMap((day, dayIndex) => {
      const who = day[boardIndex] ?? null
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
          dayIndex: odd.dayIndex,
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
        boardClaim(a.board.mode, a.board.difficulty) -
          boardClaim(b.board.mode, b.board.difficulty),
    )[0] ?? null
  )
}

// ─── Shape to prose ─────────────────────────────────────────────────────────────────────

// A board names itself in the player's language. The labels are the mode's and the
// difficulty's own, which every other screen already draws them by — the raw ids are
// identifiers and were never words.
const boardText = (board: Board, t: Translate): string =>
  `${t(labelOf(board.mode))} · ${t(DIFFICULTIES[board.difficulty].label)}`

// A board wears its own colour in the prose — the mode's gradient read at its difficulty,
// which is the app's existing rule for what a board looks like.
const boardSegment = (board: Board, text: string): Segment => ({
  text,
  kind: 'board',
  color: getDifficultyColor(board.mode, board.difficulty),
})

const dayName = (dayIndex: number, t: Translate): string => {
  const weekday = WEEKDAYS[dayIndex]
  return weekday === undefined ? '' : t(weekday)
}

export type Recap = {
  sentences: readonly Sentence[]
  shape: WeekShape
  winners: readonly (DayWinner | null)[]
}

function opener(rng: Rng, t: Translate, shape: WeekShape): Sentence {
  const top = shape.ranked[0]
  if (shape.kind === 'empty' || top === undefined) return headline(rng, t, 'empty', {})
  const leader = name(top.nickname)

  if (shape.kind === 'quiet') {
    const days = String(shape.playedDays.length)
    if (top.days === shape.playedDays.length) {
      return headline(rng, t, 'quietSweep', { A: leader, P: days })
    }
    return headline(rng, t, 'quiet', { A: leader, N: String(top.days), P: days })
  }
  if (shape.kind === 'sweep') return headline(rng, t, 'sweep', { A: leader })

  if (shape.kind === 'sweepBut') {
    const [first, second] = shape.exceptions
    if (first === undefined) return headline(rng, t, 'sweep', { A: leader })
    if (second === undefined) {
      return headline(rng, t, 'sweepBut1', {
        A: leader,
        B: name(first.nickname),
        D: dayName(first.dayIndex, t),
      })
    }
    return headline(rng, t, 'sweepBut2', {
      A: leader,
      D: dayName(first.dayIndex, t),
      E: dayName(second.dayIndex, t),
    })
  }

  if (shape.kind === 'split') {
    const runnerUp = shape.ranked[1]
    if (runnerUp === undefined) return headline(rng, t, 'sweep', { A: leader })
    return headline(rng, t, 'split', {
      A: leader,
      B: name(runnerUp.nickname),
      N: String(top.days),
      M: String(runnerUp.days),
    })
  }

  return headline(rng, t, 'scattered', {
    A: leader,
    N: String(top.days),
    C: String(shape.ranked.length),
    P: String(shape.playedDays.length),
  })
}

// `leader` is the player the headline just credited with the week, or null when the week had
// no clear one. It decides whether the board sentence agrees with the opener or has to be
// set against it.
function middle(
  rng: Rng,
  t: Translate,
  facts: WeekFacts,
  leader: string | null,
): Sentence | null {
  const story = boardStory(facts)
  if (story === null) return null

  const elsewhere = leader !== null && 'nickname' in story && story.nickname !== leader
  // A board somebody else held outright is the best counterpoint the week has, so it is kept
  // and reframed. A board they merely held *most* of is not worth spending the sentence on
  // when the opener has already named a different winner — and "stayed theirs" would be
  // overclaiming a board they lost a day of.
  if (elsewhere && story.kind === 'ownedBut') return null
  if (elsewhere && story.kind === 'owned') {
    return boardLine(rng, t, 'counterpoint', {
      BOARD: boardSegment(story.board, boardText(story.board, t)),
      W: name(story.nickname),
    })
  }
  const board = boardSegment(story.board, boardText(story.board, t))
  const mode = boardSegment(story.board, t(labelOf(story.board.mode)))

  if (story.kind === 'contested') {
    return boardLine(rng, t, 'contested', { BOARD: board, C: String(story.players) })
  }
  if (story.kind === 'owned') {
    return boardLine(rng, t, 'owned', {
      BOARD: board,
      MODE: mode,
      W: name(story.nickname),
    })
  }
  return boardLine(rng, t, 'ownedBut', {
    BOARD: board,
    MODE: mode,
    W: name(story.nickname),
    D: dayName(story.dayIndex, t),
    O: name(story.other),
  })
}

function closer(rng: Rng, t: Translate, facts: WeekFacts): Sentence {
  const [only] = facts.takeovers
  if (only === undefined) return takeoverLine(rng, t, 'none', {})
  if (facts.takeovers.length > 1) {
    return takeoverLine(rng, t, 'many', { C: String(facts.takeovers.length) })
  }
  return takeoverLine(rng, t, 'one', {
    BOARD: { text: boardText(only.board, t), kind: 'takeover' },
    D: dayName(only.dayIndex, t),
    W: name(only.nickname),
  })
}

// Names are coloured per recap, in order of first appearance, so no two people in one
// paragraph ever share a colour — which is the only promise colour has to keep here.
//
// A per-player hash was tried first and is worse than it looks: on the real five-name roster
// it put three of them on the same amber, and the paragraph where that matters most is
// exactly the one naming two players at once. Appearance order has a second virtue — the
// week's leader opens the recap, so the protagonist is always the same blue.
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

// The week, told.
//
// `seed` is the window's Monday and nothing else. Not the clock, not the render, not the
// identity of the facts object — those all change under a player who dismisses the dialog
// and opens it again, and the week would be retold in different words each time.
export function composeRecap(facts: WeekFacts, seed: string, t: Translate): Recap {
  const rng = seeded(idSeed(seed))
  const winners = dayWinners(facts)
  const shape = weekShape(winners)

  const sentences = [opener(rng, t, shape)]
  // Only a week with one name on it has a leader to set a board against; a split or a
  // scattered week has already said that nobody owned it.
  const hasLeader = shape.kind === 'sweep' || shape.kind === 'sweepBut'
  const board = middle(
    rng,
    t,
    facts,
    hasLeader ? (shape.ranked[0]?.nickname ?? null) : null,
  )
  if (board !== null) sentences.push(board)
  // A week nobody played has said everything it has to say. "Nothing all-time moved" after
  // "nobody played" is the same sentence twice.
  if (shape.kind !== 'empty') sentences.push(closer(rng, t, facts))

  return { sentences: colourNames(sentences), shape, winners }
}

// ─── The window, as a label ─────────────────────────────────────────────────────────────

// The week under the title: "22 – 28 SEPTEMBER", or "29 SEPTEMBER – 5 OCTOBER" where it
// crosses one. Plain text rather than segments, so this is the one place in the recap that
// interpolates the ordinary way instead of filling a template by hand.
//
// Nothing upper-cases the result. The English month names are already written in capitals
// because that is the register the label is set in; Czech declines the month after a day
// number — "22. – 28. září" — and shouting it would be the wrong word before it was the
// wrong case.
export function periodLabel(from: string, to: string, t: Translate): string {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  const fromDay = String(start.getUTCDate())
  const toDay = String(end.getUTCDate())
  const fromMonth = t(MONTHS[start.getUTCMonth()] ?? MONTHS[0])
  const toMonth = t(MONTHS[end.getUTCMonth()] ?? MONTHS[0])

  // Compared as months, not as the words they resolve to: two different months could share
  // a name in some language, and the window would silently lose one of them.
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return t(msg`${fromDay} – ${toDay} ${toMonth}`)
  }
  return t(msg`${fromDay} ${fromMonth} – ${toDay} ${toMonth}`)
}

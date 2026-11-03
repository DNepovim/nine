import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { TARGET_EXIT_MS } from '@/components/game/pie-countdown'
import type { TargetCard } from '@/components/game/target-card'
import { DOS_BLUE, DOS_WHITE } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useDriftedValue } from '@/hooks/use-drifted-value'
import {
  BAR_CELLS,
  commandLine,
  FIRST_COMMAND,
  keptLines,
  litCells,
  nextCommand,
  nextGap,
  resultLine,
} from '@/lib/terminal-log'
import type { OpeningTake } from '@/modes'
import { OPENING_BEATS } from '@/modes/opening-beats'

// The whole play area as an MS-DOS terminal: the `lines` **target form**.
//
// One transcript, top to bottom. The history — the command that started the run, what the
// machine has typed since, and how each target ended — then the targets still standing, one
// line each with a bar running down, and last the prompt with its cursor. A long run's history
// scrolls off the top the way a terminal's does, and the standing targets never do.
//
// The machine does not know any of this. A line target keeps the contract a disc keeps — a
// clock from its `startProgress`, stopped by `frozen` and by leaving, `onExpire` when it runs
// out, `onExitComplete` when it has gone — so a hit is still decided by the sum and an
// expiry still costs what it costs. Only the drawing differs, and the place a target was dealt
// is simply not read.
//
// The opening's scene draws nothing of its own (see openings/terminal.tsx): this board is
// typing the command that starts the run while the run is held **ready**.

// The machine typing on its own during the run: quicker than the opening, which is being
// watched, and slower than the short take, which is getting out of the way.
const BACKGROUND_PER_KEY = 90
const BACKGROUND_ENTER = 500

const CURSOR_BLINK_MS = 400
const CURSOR_WIDTH = 7
const CURSOR_HEIGHT = 13

const BAR_HEIGHT = 14
const BAR_GAP = 1

// How a line target writes itself into the history once it has gone.
const LogContext = createContext<(line: string) => void>(() => {})

function Cursor() {
  const shown = useSharedValue(1)
  useEffect(() => {
    shown.value = withRepeat(
      withSequence(
        withTiming(1, { duration: CURSOR_BLINK_MS }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: CURSOR_BLINK_MS }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    )
  }, [])
  const style = useAnimatedStyle(() => ({ opacity: shown.value }))
  return (
    <Animated.View
      style={[
        { width: CURSOR_WIDTH, height: CURSOR_HEIGHT, backgroundColor: DOS_WHITE },
        style,
      ]}
    />
  )
}

function Line({ text }: { text: string }) {
  return (
    <Text selectable={false} className={TYPE.prose} style={{ color: DOS_WHITE }}>
      {text}
    </Text>
  )
}

// One cell of the bar, lit while the clock has it. Module-level, one animated style each,
// so the bar steps down a cell at a time without a render.
function BarCell({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: litCells(progress.value) > index ? 1 : 0,
  }))
  return (
    <Animated.View
      className="flex-1"
      style={[{ height: BAR_HEIGHT, backgroundColor: DOS_WHITE }, style]}
    />
  )
}

// A target as a line: its number, and its timeout as a bar of cells running down.
export function TerminalTarget({
  target,
  duration,
  dying = false,
  frozen = false,
  clocked = true,
  driftStep = null,
  onExpire,
  onExitComplete,
}: ComponentProps<typeof TargetCard>) {
  const log = useContext(LogContext)
  const progress = useSharedValue(target.startProgress)
  const leaving = target.exit !== null || dying
  const running = !leaving && !frozen && clocked
  const reading = useDriftedValue(target, driftStep, !leaving && !frozen)
  const shown = target.takenAt ?? reading

  // The same clock the disc runs: down from wherever it stands, so a pause costs nothing and
  // gives nothing, and cancelled reports not-finished, so a frozen target does not expire.
  useEffect(() => {
    if (!running) {
      cancelAnimation(progress)
      return
    }
    progress.value = withTiming(
      0,
      { duration: duration * progress.value, easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(onExpire)
      },
    )
  }, [running])

  // Gone: a beat showing how it ended, then into the history and off the board.
  useEffect(() => {
    if (target.exit === null) return
    const timer = setTimeout(() => {
      log(resultLine(shown, target.exit ?? 'failed'))
      onExitComplete()
    }, TARGET_EXIT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [target.exit])

  // A hit inverts the line, the way a DOS selection does. Loss says so in words.
  const hit = target.exit === 'hit'
  const result = target.exit === null ? null : resultLine(shown, target.exit)
  const ink = hit ? DOS_BLUE : DOS_WHITE
  return (
    <View
      className="flex-row items-center gap-2 px-1"
      style={{ backgroundColor: hit ? DOS_WHITE : DOS_BLUE }}
    >
      <Text selectable={false} className={TYPE.figureLarge} style={{ color: ink }}>
        {result ?? shown}
      </Text>
      {result === null && (
        <View className="flex-1 flex-row" style={{ gap: BAR_GAP }}>
          {Array.from({ length: BAR_CELLS }, (_, index) => (
            <BarCell key={index} index={index} progress={progress} />
          ))}
        </View>
      )}
    </View>
  )
}

// The transcript, for one run. A run that was not held when this mounted — one restored
// after the app was closed — has already started, so its first command is there in full.
function Transcript({
  take,
  held,
  children,
}: {
  take: OpeningTake
  held: boolean
  children: ReactNode
}) {
  const [lines, setLines] = useState<readonly string[]>([])
  // What is being typed, or null while the prompt sits empty between commands.
  const [current, setCurrent] = useState<string | null>(FIRST_COMMAND)
  const [typed, setTyped] = useState(held ? 0 : FIRST_COMMAND.length)
  const [lastCommand, setLastCommand] = useState(FIRST_COMMAND)
  // The opening's command keeps the opening's own beats, so the run starts as it is entered.
  const opening = current === FIRST_COMMAND

  useEffect(() => {
    const beats = OPENING_BEATS[take]
    const perKey = opening ? beats.perKey : BACKGROUND_PER_KEY
    const timer =
      current === null
        ? setTimeout(() => {
            const next = nextCommand(lastCommand, Math.random())
            setCurrent(next)
            setLastCommand(next)
            setTyped(0)
          }, nextGap(Math.random()))
        : typed < current.length
          ? setTimeout(
              () => {
                setTyped(typed + 1)
              },
              typed === 0 && opening ? beats.before + perKey : perKey,
            )
          : setTimeout(
              () => {
                setLines((was) => keptLines(was, commandLine(current)))
                setCurrent(null)
              },
              opening ? beats.enter : BACKGROUND_ENTER,
            )
    return () => {
      clearTimeout(timer)
    }
  }, [current, typed])

  const log = (line: string) => {
    setLines((was) => keptLines(was, line))
  }

  return (
    <LogContext.Provider value={log}>
      <View className="absolute inset-0">
        {/* Shrinks when the screen is full, and pinned to its foot as it does, so it is the
            oldest lines that go out of sight rather than the newest. */}
        <View
          className="justify-end overflow-hidden"
          style={{ flexShrink: 1, minHeight: 0 }}
          pointerEvents="none"
          aria-hidden
        >
          {lines.map((line, index) => (
            // Scrolled by position, like the screen it is: a line has no identity of its own.
            <Line key={index} text={line} />
          ))}
        </View>
        {children}
        <View className="flex-row items-center" pointerEvents="none" aria-hidden>
          <Line text={commandLine(current?.slice(0, typed) ?? '')} />
          <Cursor />
        </View>
      </View>
    </LogContext.Provider>
  )
}

// Keyed on the run here rather than by the caller: the other form must not be remounted on a
// new run, or the last run's discs would be cut off on their way out.
export function TerminalBoard({
  runId,
  take,
  held,
  children,
}: {
  runId: string
  take: OpeningTake
  held: boolean
  children: ReactNode
}) {
  return (
    <Transcript key={runId} take={take} held={held}>
      {children}
    </Transcript>
  )
}

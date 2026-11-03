// The rules of the terminal BINARY's run is played in: what the machine types next, how long
// it waits first, what a finished target leaves behind and how much history it keeps.
//
// Pure, with the randomness handed in, so the things worth holding can be tested.

// Everything the terminal prints is the machine talking, in the same English in every
// language, like the NINE wordmark: none of this is copy.
const PROMPT = 'C:\\>'
export const FIRST_COMMAND = 'START NINE.EXE'

const RESULT = { hit: 'OK', failed: 'TIMEOUT' } as const

export const commandLine = (command: string): string => `${PROMPT}${command}`

// What a target leaves in the history once it is finished with.
export const resultLine = (value: number, result: keyof typeof RESULT): string =>
  `${value} ${RESULT[result]}`

// What the machine gets up to while the player works. All of it is DOS, and most of it is
// about bits, because that is what the player is reading. No `CLS`: the history, and the
// command that started the run at the top of it, are meant to stay.
export const BACKGROUND_COMMANDS = [
  'ECHO 01001110',
  'SET BIT=1',
  'TYPE BYTE.TXT',
  'DIR /B BITS',
  'CHKDSK C:',
  'MEM /C',
  'COPY A:\\BITS.DAT C:\\',
  'ATTRIB +H NINE.EXE',
  'VER',
] as const

// More than ever fit the screen, where the oldest simply scroll out of sight: this is only
// the bound that stops a long run's history growing for ever.
const KEPT_LINES = 40

export const keptLines = (lines: readonly string[], line: string): readonly string[] =>
  [...lines, line].slice(-KEPT_LINES)

// The next command, never the one just typed: a machine repeating itself reads as a bug.
// `random` is 0 up to but not including 1, as `Math.random` gives.
export const nextCommand = (last: string, random: number): string => {
  const others = BACKGROUND_COMMANDS.filter((command) => command !== last)
  return others[Math.floor(random * others.length)] ?? FIRST_COMMAND
}

// How long the prompt sits empty before the next command, in ms. Long enough that a command
// arriving is a small event and not a ticker: the player is meant to glance, not to read.
const GAP_MIN_MS = 7000
const GAP_SPREAD_MS = 8000

export const nextGap = (random: number): number => GAP_MIN_MS + random * GAP_SPREAD_MS

// How many cells the timeout bar is drawn in, and how many are lit for the clock left. A
// bar that steps rather than slides is what makes it read as text on a terminal. Rounded up
// so the last cell stays lit until the clock is actually out. A worklet, because the bar
// asks on every frame.
export const BAR_CELLS = 16

export const litCells = (progress: number): number => {
  'worklet'
  return Math.min(BAR_CELLS, Math.max(0, Math.ceil(progress * BAR_CELLS)))
}

import { describe, expect, it } from 'vitest'

import {
  BACKGROUND_COMMANDS,
  BAR_CELLS,
  commandLine,
  keptLines,
  litCells,
  nextCommand,
  nextGap,
  resultLine,
} from '@/lib/terminal-log'

describe('nextCommand', () => {
  it('never types the command it has just typed, whatever the roll', () => {
    for (const last of BACKGROUND_COMMANDS) {
      for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(nextCommand(last, random)).not.toBe(last)
      }
    }
  })

  it('reaches every command there is', () => {
    const rolled = new Set(
      Array.from({ length: 100 }, (_, i) => nextCommand('START NINE.EXE', i / 100)),
    )
    expect(rolled).toEqual(new Set(BACKGROUND_COMMANDS))
  })
})

describe('the lines', () => {
  it('prints a command on the prompt and a target by how it ended', () => {
    expect(commandLine('VER')).toBe('C:\\>VER')
    expect(resultLine(173, 'hit')).toBe('173 OK')
    expect(resultLine(173, 'failed')).toBe('173 TIMEOUT')
  })
})

describe('keptLines', () => {
  it('keeps the start of the run through an ordinary one', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `${i}`).reduce<readonly string[]>(
      keptLines,
      ['START'],
    )
    expect(lines[0]).toBe('START')
  })

  it('stops growing, dropping the oldest first', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `${i}`).reduce<readonly string[]>(
      keptLines,
      [],
    )
    expect(lines).toHaveLength(40)
    expect(lines.at(-1)).toBe('99')
  })
})

describe('nextGap', () => {
  it('waits seven seconds at the least and under fifteen at the most', () => {
    expect(nextGap(0)).toBe(7000)
    expect(nextGap(0.999)).toBeLessThan(15000)
  })
})

describe('litCells', () => {
  it('fills the bar on a full clock and empties it on none', () => {
    expect(litCells(1)).toBe(BAR_CELLS)
    expect(litCells(0)).toBe(0)
  })

  it('keeps the last cell lit until the clock is actually out', () => {
    expect(litCells(0.001)).toBe(1)
  })
})

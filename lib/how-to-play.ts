import { z } from 'zod'

// What survives a visit to How to Play: one bit, saying the player has read the guide.
//
// It used to be the tutorial's flag — the hands-on lessons that opened from the same
// screen and stored "been through it" when they were closed. The lessons are gone and
// the guide is the whole of the teaching now, so the bit moved with the teaching: it
// goes in when the guide is closed, however far down the player got.
const readSchema = z.object({ read: z.boolean().optional() })

function safeJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return null
  }
}

// Anything unreadable degrades to "not read yet", which costs the player nothing they can
// see: the only thing hanging off this flag is an achievement, and the guide is on the
// same shelf either way.
export function parseGuideRead(raw: string | null): boolean {
  if (raw === null) return false
  const parsed = readSchema.safeParse(safeJson(raw))
  if (!parsed.success) return false
  return parsed.data.read === true
}

export function serializeGuideRead(read: boolean): string {
  return JSON.stringify({ read })
}

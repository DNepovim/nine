import { noteRequest } from '@/lib/connectivity'
import { windowDays, type StatsWindow } from '@/lib/stats-window'
import { supabase } from '@/lib/supabase'

// How the app is doing, beside features.ts, roles.ts and sessions.ts: the fourth thing
// the admin screen administers, and the only one of the four that reads rather than
// writes.
//
// One call per window and nothing computed here. The arithmetic is in `admin_stats` —
// that function is `security definer` because two of the tables it counts are server-only
// (`run_receipts`) or confidential (`feedback`), and a client cannot select from either
// however the counts are shaped. What this file does is name the window and rename the
// columns.

type StatsDay = {
  day: string
  runs: number
  players: number
}

type StatsBoard = {
  mode: string
  difficulty: string
  runs: number
  players: number
}

type StatsSession = {
  id: string
  // The challenge by registry id, which this build may never have heard of — the same
  // arrangement `AdminSession.modeId` has, and the screen resolves it the same way.
  modeId: string
  opensAt: number
  players: number
  // Null is a session nobody has posted a score on, which is not the same as nought.
  best: number | null
}

export type AdminStats = {
  players: {
    total: number
    named: number
    joined: number
    // Of the ones that joined in the window, how many have since given themselves a
    // nickname. There is no timestamp on a nickname, so this is as close as the database
    // gets to "named themselves this week" — see the note in the migration.
    joinedNamed: number
    joinedBefore: number
  }
  runs: {
    runs: number
    // Distinct profiles that posted a run in the window: the only active-player figure
    // this database can answer.
    players: number
    hits: number
    minutes: number
    before: number
  }
  // A fortnight ending on the window's last day, whatever the window is. One row per day
  // including the days nobody played.
  series: readonly StatsDay[]
  boards: readonly StatsBoard[]
  sessions: readonly StatsSession[]
  pulse: {
    feedback: number
    achievements: number
    rooms: number
    reigns: number
  }
}

// The shape `admin_stats` builds, with the column names SQL uses. Named separately
// rather than parsed, the way every other file in this folder reads its rows: one place
// says what the server sends and one place says what the app calls it.
type StatsPayload = {
  players: {
    total: number
    named: number
    joined: number
    joined_named: number
    joined_before: number
  }
  runs: {
    runs: number
    players: number
    hits: number
    minutes: number
    before: number
  }
  series: readonly StatsDay[]
  boards: readonly StatsBoard[]
  sessions: readonly {
    id: string
    mode_id: string
    opens_at: string
    players: number
    best: number | null
  }[]
  pulse: {
    feedback: number
    achievements: number
    rooms: number
    reigns: number
  }
}

export async function loadStats(
  window: StatsWindow,
): Promise<{ stats: AdminStats | null; error: string | null }> {
  const { from, to } = windowDays(window)
  const res = await supabase.rpc('admin_stats', { p_from: from, p_to: to })
  noteRequest(res.error)
  if (res.error) return { stats: null, error: res.error.message }
  const payload = res.data as StatsPayload | null
  if (payload === null) return { stats: null, error: 'admin_stats returned nothing' }
  return {
    stats: {
      players: {
        total: payload.players.total,
        named: payload.players.named,
        joined: payload.players.joined,
        joinedNamed: payload.players.joined_named,
        joinedBefore: payload.players.joined_before,
      },
      runs: payload.runs,
      series: payload.series,
      boards: payload.boards,
      sessions: payload.sessions.map((row) => ({
        id: row.id,
        modeId: row.mode_id,
        // `timestamptz` arrives as an ISO string; everything above this line works in ms
        // since the epoch, which is what every other clock in the app uses.
        opensAt: new Date(row.opens_at).getTime(),
        players: row.players,
        best: row.best,
      })),
      pulse: {
        feedback: payload.pulse.feedback,
        achievements: payload.pulse.achievements,
        rooms: payload.pulse.rooms,
        reigns: payload.pulse.reigns,
      },
    },
    error: null,
  }
}

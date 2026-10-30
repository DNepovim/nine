import { noteRequest } from '@/lib/connectivity'
import { supabase } from '@/lib/supabase'

// What players made of a challenge: how many **ratings** its sessions have had, and their
// plain average to one decimal. Keyed by the challenge's registry id as the row says it —
// a plain string, for the reason `AdminSession.modeId` is one.
export type ChallengeRating = { ratings: number; average: number }

type RatingRow = { mode_id: string; ratings: number; average: number | string }

// Admins only, and refused for anybody else — see `challenge_ratings`. The lab is open
// to testers as well, so a refusal is an ordinary answer here rather than a failure: the
// map comes back empty and the screen draws no rating lines, as it does for a challenge
// nobody has rated.
export async function listChallengeRatings(): Promise<
  ReadonlyMap<string, ChallengeRating>
> {
  const res = await supabase.rpc('challenge_ratings')
  noteRequest(res.error)
  if (res.error) return new Map()
  return new Map(
    ((res.data as RatingRow[] | null) ?? []).map((row) => [
      row.mode_id,
      // `numeric` arrives as a string from PostgREST; `Number` reads either.
      { ratings: row.ratings, average: Number(row.average) },
    ]),
  )
}

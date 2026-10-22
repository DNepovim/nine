import { noteRequest } from '@/lib/connectivity'
import { NO_PLACES, type SessionPlaces } from '@/lib/session-places'
import { supabase } from '@/lib/supabase'

// The read behind `SessionPlaces`: one row of four counts, answered for the caller alone.

type PlacesRow = {
  podiums: number
  wins: number
  photo_finishes: number
  firsts: number
}

export async function loadSessionPlaces(): Promise<SessionPlaces | null> {
  const res = await supabase.rpc('my_session_places')
  noteRequest(res.error)
  // A build older than the migration lands here too. Null rather than NO_PLACES, so the
  // hook keeps whatever it already knew instead of forgetting it.
  if (res.error) return null
  const row = (res.data as PlacesRow[] | null)?.[0]
  if (row === undefined) return NO_PLACES
  return {
    podiums: row.podiums,
    wins: row.wins,
    photoFinishes: row.photo_finishes,
    firsts: row.firsts,
  }
}

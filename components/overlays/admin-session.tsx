import { AdminSessionLive } from '@/components/overlays/admin-session-live'
import { AdminSessionPlanned } from '@/components/overlays/admin-session-planned'
import type { AdminSession as Session } from '@/lib/admin/sessions'
import { spanStatus, type PastRuns } from '@/lib/challenge-session'

// One **session**'s detail, in the shape its moment calls for: a planned one is a ballot an
// admin can edit, a running or finished one is a record that cannot change challenge.
//
// A shell and not a form. It used to be one form for every state, and what it offered
// differed so much by state — a select here, EXTEND there, nothing at all for a past row —
// that each state is its own component now and this picks between them.
export function AdminSession({
  session,
  voting,
  pastRuns,
  now,
  pending,
  onChanged,
  onBack,
}: {
  session: Session
  // Whether this is the session being voted on — see `votingSession`. Only the list knows,
  // having every row to hand.
  voting: boolean
  // How many sessions of each challenge have closed and when the last one did, by registry
  // id — read off the rows the list already loaded, for the edit dialog's figures.
  pastRuns: ReadonlyMap<string, PastRuns>
  // The list's own clock, which the runs above were read against.
  now: number
  // The challenges held back, which the edit dialog does not offer.
  pending: ReadonlySet<string>
  onChanged: () => void
  // Where BACK, and every finished write, ends up: the list.
  onBack: () => void
}) {
  return spanStatus(session, now) === 'upcoming' ? (
    <AdminSessionPlanned
      session={session}
      voting={voting}
      pastRuns={pastRuns}
      now={now}
      pending={pending}
      onChanged={onChanged}
      onBack={onBack}
    />
  ) : (
    <AdminSessionLive session={session} now={now} onChanged={onChanged} onBack={onBack} />
  )
}

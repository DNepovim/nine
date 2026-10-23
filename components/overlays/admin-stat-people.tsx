import { Trans } from '@lingui/react/macro'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ScrollView, Text } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { AdminDialog } from '@/components/overlays/admin-dialog'
import { NameCell } from '@/components/overlays/admin-people'
import { AdminTable, type AdminColumn } from '@/components/overlays/admin-table'
import { TYPE } from '@/constants/typography'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import { linesFor, type StatTileKey } from '@/lib/admin/stat-people'
import { loadStatsPeople, type StatsPerson } from '@/lib/admin/stats'
import { cn } from '@/lib/cn'
import { type StatsWindow } from '@/lib/stats-window'

// The figure column's caption, by what the rows carry. Not translated, as no column label
// on these screens is.
const FIGURE_LABEL: Record<StatTileKey, string> = {
  joined: 'RUNS',
  named: 'RUNS',
  played: 'RUNS',
  runs: 'RUNS',
  minutes: 'MIN',
  hits: 'HITS',
}

// A row's figure as it is printed. Minutes keep one decimal: a list of short runs rounded
// to whole minutes reads as a column of noughts under a tile that says four. The tile is
// the total rounded once, so the rows add up to it to within that tenth.
const figureOf = (tile: StatTileKey, figure: number): string =>
  tile === 'minutes' ? figure.toFixed(1) : String(Math.round(figure))

// A list as tall as about a dozen rows before it scrolls: past that, the card would run
// off a phone held upright.
const LIST_MAX_HEIGHT = 380

// The players behind one tile at the top of the analytics screen.
//
// Read when it opens and not before, so the screen itself stays one call that names
// nobody — see `admin_stats_people`. Read per window rather than per tile: the six lists
// are six filters over the same rows, so switching tiles is free and only a different
// window asks again.
export function AdminStatPeople({
  tile,
  title,
  window,
  onDismiss,
}: {
  tile: StatTileKey
  // The tile's own label, so the card is headed by what was pressed.
  title: ReactNode
  window: StatsWindow
  onDismiss: () => void
}) {
  const [people, setPeople] = useState<readonly StatsPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const read = { stale: false }
    void (async () => {
      const res = await loadStatsPeople(window)
      if (read.stale) return
      setPeople(res.people)
      setError(res.error)
    })()
    return () => {
      read.stale = true
    }
  }, [window])

  const lines = useMemo(
    () => (people === null ? [] : linesFor(tile, people)),
    [tile, people],
  )
  const ids = useMemo(
    () => lines.flatMap((line) => (line.userId === null ? [] : [line.userId])),
    [lines],
  )
  const factorsOf = usePlayerFactors(ids.length === 0 ? EMPTY_IDS : ids)

  const columns: readonly AdminColumn[] = [
    { label: 'PLAYER', tone: 'name' },
    { label: FIGURE_LABEL[tile], width: 56, align: 'right', tone: 'figure' },
  ]

  return (
    <AdminDialog title={title} onDismiss={onDismiss}>
      <ScrollView
        style={{ maxHeight: LIST_MAX_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTable
          columns={columns}
          loading={people === null && error === null}
          error={error}
          empty={<Trans>Nobody in this window.</Trans>}
          rows={lines.map((line) => ({
            key: line.userId ?? 'unnamed',
            cells: [
              line.userId === null ? (
                <Text selectable={false} className={cn(TYPE.prose, 'shrink text-dim')}>
                  <Trans>{line.count} without a nickname</Trans>
                </Text>
              ) : (
                <NameCell person={line} factors={factorsOf(line.userId)} me={false} />
              ),
              figureOf(tile, line.figure),
            ],
          }))}
        />
      </ScrollView>
      {/* A visible way out. The scrim closes it as well, but a list long enough to fill the
          card leaves little beside it to tap. */}
      <LinkButton
        id="shared.dialog_close"
        className="mt-3 self-center"
        onPress={onDismiss}
        icon="close-outline"
        label={<Trans>CLOSE</Trans>}
      />
    </AdminDialog>
  )
}

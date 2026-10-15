import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import {
  AdminChip,
  AdminTable,
  type AdminTableRow,
} from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import { listMessages, type AdminMessage } from '@/lib/admin/feedback'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format-date'

// What players have written in, newest first.
//
// The fourth door off the hub, and the one that was missing entirely: a message went into
// the database and waited there for somebody to go and look. Nothing in the app said one
// had arrived — which is why this screen's real output is the dot on the hub tile and on
// the ADMIN link, and the list is what the dot leads to.
//
// **It reads and does not write.** An answer is written by hand, by the `answer-feedback`
// skill, from a machine that has the production credentials and the build the answer is
// about. What this screen is for is knowing there is one to write, reading what was said,
// and seeing whether the player has collected the reply.
const TITLE = msg`MESSAGES`

// Which messages are listed. OWED first and chosen by default: it is the only one of the
// three that is a thing to do, and a list of everything ever sent in is the thing you
// look at second.
type Filter = 'owed' | 'answered' | 'all'

const FILTER_LABEL: Record<Filter, string> = {
  owed: 'OWED',
  answered: 'ANSWERED',
  all: 'ALL',
}

const FILTERS: readonly Filter[] = ['owed', 'answered', 'all']

const matches = (message: AdminMessage, filter: Filter): boolean => {
  if (filter === 'all') return true
  return filter === 'owed' ? message.answer === null : message.answer !== null
}

export function AdminMessages({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  const [rows, setRows] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('owed')
  // Which message is open. The text is a paragraph and the list is a list — a row shows
  // the first line of it, and opening one gives the whole thing the room it needs. Held
  // by id rather than by row, so a reload under an open message keeps it open.
  const [open, setOpen] = useState<string | null>(null)

  // Every name on screen in one lookup, so a player is the same colour here as on a board
  // row. See `usePlayerFactors`.
  const authors = rows
    .map((row) => row.authorId)
    .filter((id): id is string => id !== null)
  const factorsOf = usePlayerFactors(authors.length === 0 ? EMPTY_IDS : authors)

  useEffect(() => {
    void (async () => {
      const res = await listMessages()
      setRows(res.rows)
      setError(res.error)
      setLoading(false)
    })()
  }, [])

  const shown = rows.filter((row) => matches(row, filter))

  const tableRows: readonly AdminTableRow[] = shown.map((message) => {
    const owed = message.answer === null
    return {
      key: message.id,
      leads: false,
      // An answered message that the player has already collected is finished with, and
      // the only one of the three states that is. Faded rather than hidden — the ANSWERED
      // filter is for reading them back.
      faded: !owed && message.seenAt !== null,
      cells: [
        <View className="flex-row items-center gap-1.5">
          {message.nickname === null ? (
            <Text selectable={false} className={cn(TYPE.prose, 'shrink text-dim')}>
              <Trans>(profile removed)</Trans>
            </Text>
          ) : (
            <GradientName
              nickname={message.nickname}
              avgAccuracy={factorsOf(message.authorId).avgAccuracy}
              avgSpeed={factorsOf(message.authorId).avgSpeed}
              numberOfLines={1}
              className={cn(TYPE.prose, 'shrink')}
            />
          )}
          {owed ? (
            <AdminChip label={t(msg`OWED`)} tone="danger" />
          ) : message.seenAt === null ? (
            // Answered, and the player has not opened it yet. Worth its own word: it is
            // the one state where the work is done and the loop is not closed.
            <AdminChip label={t(msg`IN THE POST`)} tone="strong" />
          ) : null}
        </View>,
        formatShortDate(new Date(message.sentAt).toISOString()),
      ],
      onPress: () => {
        setOpen(open === message.id ? null : message.id)
      },
      note: (
        <View>
          <Text
            selectable
            // One line in the list and all of it when opened. `selectable` because the
            // one thing somebody does with a message on this screen is copy its words —
            // and its id — into the answer they are about to write.
            numberOfLines={open === message.id ? undefined : 1}
            className={cn(TYPE.value, 'text-primary')}
          >
            {message.message}
          </Text>
          {open === message.id && (
            <View className="mt-1.5 gap-1.5">
              {/* What the player was looking at when they wrote it, and which build they
                  were on — the two facts that turn a complaint into something
                  reproducible. */}
              <Text selectable className={cn(TYPE.hint, 'text-dim')}>
                {message.mode} · {message.difficulty} · {message.score} · {message.build}
              </Text>
              {/* The row id, because the answer is written against it: `/answer-feedback
                  <row id>` is the command, and this screen is where that id comes from. */}
              <Text selectable className={cn(TYPE.hint, 'text-dim')}>
                {message.id}
              </Text>
              {message.answer !== null && (
                <View className="rounded-lg border border-muted bg-card px-2 py-1.5">
                  <Text selectable={false} className={cn(TYPE.caption, 'mb-1 text-dim')}>
                    <Trans>THE ANSWER</Trans>
                  </Text>
                  <Text selectable className={cn(TYPE.value, 'text-primary')}>
                    {message.answer}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      ),
    }
  })

  return (
    <AdminScreen
      title={t(TITLE)}
      error={error}
      footer={
        <PrimaryButton id="admin.back" onPress={onBack} label={<Trans>BACK</Trans>} />
      }
    >
      <AdminSegments
        id="admin.filter"
        className="mb-2.5"
        value={filter}
        onSelect={setFilter}
        options={FILTERS.map((option) => ({
          value: option,
          // The count beside the word, because the one thing this screen is asked is *how
          // many*. On the chosen segment as well as the others: it is the figure, not a
          // preview of what pressing would do.
          label: `${FILTER_LABEL[option]} ${rows.filter((row) => matches(row, option)).length}`,
        }))}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <AdminTable
          rowId="admin.message"
          loading={loading}
          columns={[
            { label: 'FROM', tone: 'name' },
            { width: 52, align: 'right' },
          ]}
          rows={tableRows}
          empty={
            filter === 'owed' ? (
              <Trans>Nothing is waiting for an answer.</Trans>
            ) : (
              <Trans>No messages.</Trans>
            )
          }
        />
      </ScrollView>
    </AdminScreen>
  )
}

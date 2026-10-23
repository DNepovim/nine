import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { Platform, ScrollView, Text, TextInput, View } from 'react-native'

import { GradientName } from '@/components/gradient-name'
import { AdminDialog } from '@/components/overlays/admin-dialog'
import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import {
  AdminChip,
  AdminTable,
  type AdminTableRow,
} from '@/components/overlays/admin-table'
import { PrimaryButton } from '@/components/primary-button'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { EMPTY_IDS, usePlayerFactors } from '@/hooks/use-player-factors'
import {
  answerMessage,
  dismissMessage,
  listMessages,
  stateOf,
  type AdminMessage,
  type MessageState,
} from '@/lib/admin/feedback'
import { cn } from '@/lib/cn'
import { MAX_FEEDBACK_LENGTH } from '@/lib/feedback-outcome'
import { formatShortDate } from '@/lib/format-date'

// What players have written in, newest first — and the two things that can be done about
// one.
//
// The fourth door off the hub, and the one that was missing entirely: a message went into
// the database and waited there for somebody to go and look. Nothing in the app said one
// had arrived — which is why this screen's real output is the dot on the hub tile and on
// the ADMIN link, and the list is what the dot leads to.
//
// **The quick half of answering is here.** A considered answer still belongs to the
// `answer-feedback` skill, which drafts against what a session actually changed and sets
// `answer_needs_build` so that a reply saying *fixed* waits for a build carrying the fix.
// That stamp is read off a diff and no phone can know it. What this screen does is the
// rest: the reply that needs no gate, and the message that wants no reply at all.
const TITLE = msg`MESSAGES`

// Which messages are listed. OWED first and chosen by default: it is the only one of the
// four that is a thing to do, and a list of everything ever sent in is the thing you look
// at second.
//
// The three states plus ALL, rather than a word of its own invention: a segment here and
// a chip on the row answer the same question, so they read the same answer off
// `stateOf`.
type Filter = MessageState | 'all'

const FILTER_LABEL: Record<Filter, string> = {
  owed: 'OWED',
  answered: 'ANSWERED',
  dismissed: 'SET ASIDE',
  all: 'ALL',
}

const FILTERS: readonly Filter[] = ['owed', 'answered', 'dismissed', 'all']

const matches = (message: AdminMessage, filter: Filter): boolean =>
  filter === 'all' || stateOf(message) === filter

// Writing the reply.
//
// A dialog rather than a field under the row: an answer is up to 800 characters and the
// row it belongs to is two lines in a list, so a field there would push every other
// message off the screen while it was being typed. `AdminDialog` is the window every
// dialog on these screens uses — a platform modal, raised from inside a scrolling pane.
//
// The draft opens on whatever answer the message already carries, because the second
// reason to open this is to correct the first answer. Re-writing one re-sends it: the
// trigger on the column clears `answer_seen_at`, which is deliberate and is why the
// button below says so.
function AnswerDialog({
  message,
  busy,
  onSend,
  onDismiss,
}: {
  message: AdminMessage
  busy: boolean
  // Answers whether the server took it, so a refusal keeps both the dialog and the draft
  // — retyping a paragraph is the one thing the writer must not be asked to do.
  onSend: (answer: string) => Promise<boolean>
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const [draft, setDraft] = useState(message.answer ?? '')
  const text = draft.trim()
  const again = message.answer !== null

  return (
    <AdminDialog
      title={again ? <Trans>REWRITE THE ANSWER</Trans> : <Trans>ANSWER</Trans>}
      onDismiss={onDismiss}
      // Held against the answer it opened on, not against empty: reopening an answer to
      // read it and tapping away throws nothing away.
      held={draft !== (message.answer ?? '')}
    >
      <View>
        {/* What is being answered, above the field. The list is behind a scrim by now,
            and an answer written without the question in front of you is how a reply
            comes to address the wrong half of a long message. */}
        <Text
          selectable={false}
          numberOfLines={4}
          className={cn(TYPE.value, 'mb-2.5 text-dim')}
        >
          {message.message}
        </Text>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          editable={!busy}
          maxLength={MAX_FEEDBACK_LENGTH}
          placeholder={t`Type the answer`}
          placeholderTextColor={DIM_INK}
          autoFocus
          className="h-28 w-full rounded-xl border border-muted bg-elevated p-2.5 font-mono leading-[18px] text-primary"
          // Mobile Safari zooms the page in on focus for any input under 16px, with no
          // CSS opt-out — the same exception the player's own feedback field makes.
          style={{
            textAlignVertical: 'top',
            fontSize: Platform.OS === 'web' ? 16 : 12,
          }}
        />

        {again && (
          // Said before the press rather than after it: a correction is delivered again,
          // which is the point of allowing one and also the cost of an idle edit.
          <Text selectable={false} className={cn(TYPE.hint, 'mt-1.5 text-dim')}>
            <Trans>Sending again — the player sees this reply once more.</Trans>
          </Text>
        )}

        <PrimaryButton
          id="admin.message_answer"
          className="mt-3"
          disabled={busy || text === ''}
          onPress={() => {
            void (async () => {
              if (await onSend(text)) onDismiss()
            })()
          }}
          label={again ? <Trans>SEND AGAIN</Trans> : <Trans>SEND</Trans>}
        />
      </View>
    </AdminDialog>
  )
}

export function AdminMessages({
  // Said after every write, because what changed is not only this list: the hub behind it
  // draws a dot counting the messages still owed an answer, and answering one or setting
  // it aside is exactly the thing that changes that count.
  onChanged,
  onBack,
}: {
  onChanged: () => void
  onBack: () => void
}) {
  const { t } = useLingui()
  const [rows, setRows] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('owed')
  // Which message is open. The text is a paragraph and the list is a list — a row shows
  // the first line of it, and opening one gives the whole thing the room it needs. Held
  // by id rather than by row, so a reload under an open message keeps it open.
  const [open, setOpen] = useState<string | null>(null)
  // Which message is being answered, if any. By id for the same reason `open` is.
  const [answering, setAnswering] = useState<string | null>(null)
  // A write in flight. One flag for the screen rather than one per row: two writes at
  // once on the same list is a race for the same rows, and nothing here is worth racing.
  const [busy, setBusy] = useState(false)

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

  // What a write leaves behind, applied to the one row it was about.
  //
  // Patched in place rather than re-listing. The server has already said yes by the time
  // this runs, and re-reading the whole list would redraw every row and lose the filter's
  // place under the reader's thumb — on a screen where the row they just acted on is
  // usually about to leave the list it is being read in.
  const patch = (id: string, change: Partial<AdminMessage>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...change } : row)),
    )
  }

  const send = async (message: AdminMessage, answer: string): Promise<boolean> => {
    setBusy(true)
    const res = await answerMessage(message.id, answer)
    setBusy(false)
    setError(res.error)
    if (res.error !== null) return false
    // The two stamps are the database's, so this mirrors what the trigger did rather than
    // inventing figures: answered now, not yet seen, and no longer set aside.
    patch(message.id, {
      answer,
      answeredAt: Date.now(),
      seenAt: null,
      dismissedAt: null,
    })
    onChanged()
    return true
  }

  const setAside = async (message: AdminMessage, dismissed: boolean) => {
    setBusy(true)
    const res = await dismissMessage(message.id, dismissed)
    setBusy(false)
    setError(res.error)
    if (res.error !== null) return
    patch(message.id, { dismissedAt: dismissed ? Date.now() : null })
    onChanged()
  }

  const shown = rows.filter((row) => matches(row, filter))
  const answered = rows.find((row) => row.id === answering) ?? null

  const tableRows: readonly AdminTableRow[] = shown.map((message) => {
    const state = stateOf(message)
    return {
      key: message.id,
      leads: false,
      // A message that is finished with, which is two of the four states: an answer the
      // player has collected, and one deliberately set aside. Faded rather than hidden —
      // the filters are for reading them back.
      faded: state === 'dismissed' || (state === 'answered' && message.seenAt !== null),
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
          {state === 'owed' ? (
            <AdminChip label={t(msg`OWED`)} tone="danger" />
          ) : state === 'dismissed' ? (
            // `ASIDE` rather than the button's `SET ASIDE`: a chip says what the row *is*
            // and a button says what pressing it *does*, and in a language that inflects
            // the two cannot be one word. The filter above the list names the pile.
            <AdminChip label={t(msg`ASIDE`)} tone="quiet" />
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
              {/* The row id. Still printed, and still selectable, because the other way
                  to answer one of these is `/answer-feedback <row id>` — the considered
                  reply, written from a machine that knows which build carries the fix. */}
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

              {/* The two things that can be done about a message, under the message
                  itself. Compact, side by side, and only on the open row: a list of
                  messages is read far more often than it is acted on. */}
              <View className="mt-0.5 flex-row gap-2">
                <PrimaryButton
                  id="admin.message_open_answer"
                  className="flex-1"
                  variant="compact"
                  disabled={busy}
                  onPress={() => {
                    setAnswering(message.id)
                  }}
                  label={
                    message.answer === null ? (
                      <Trans>ANSWER</Trans>
                    ) : (
                      <Trans>REWRITE</Trans>
                    )
                  }
                />
                {/* An answered message cannot be set aside — the pile is for the ones
                    that will never be answered, and the server refuses it too. So the
                    second button is the restore, or nothing at all. */}
                {state !== 'answered' && (
                  <PrimaryButton
                    id="admin.message_dismiss"
                    className="flex-1"
                    variant="compact"
                    tone="quiet"
                    disabled={busy}
                    onPress={() => {
                      void setAside(message, state !== 'dismissed')
                    }}
                    label={
                      state === 'dismissed' ? (
                        <Trans>PUT BACK</Trans>
                      ) : (
                        <Trans>SET ASIDE</Trans>
                      )
                    }
                  />
                )}
              </View>
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

      {answered !== null && (
        <AnswerDialog
          // Keyed on the row, so opening a second message after a first gets a field
          // holding that message's own answer rather than the one before it.
          key={answered.id}
          message={answered}
          busy={busy}
          onSend={(answer) => send(answered, answer)}
          onDismiss={() => {
            setAnswering(null)
          }}
        />
      )}
    </AdminScreen>
  )
}

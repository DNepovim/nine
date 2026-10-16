import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { SkeletonBar, SkeletonPulse } from '@/components/overlays/skeleton'
import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { DIM_INK, ON_STRONG_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The one table the admin screens are drawn in.
//
// Six lists were six tables: people hung its name on a `flex-1` row with a 20px role
// column, roles put two counts in one string, features opened with a 68px pill, sessions
// stacked two lines in a column and the planner's own rows did it a fifth way. Nothing
// chose those shapes — each was typed next to whatever was already on screen, which is
// the same drift `PrimaryButton` and `TYPE` were pulled together to stop. A column that
// means the same thing on two lists now sits at the same place on both, and a row is one
// height everywhere.
//
// **It does not scroll.** A table is a block inside the screen's own scroller, because
// most of these lists sit under a filter or above a footer that scrolls with them, and a
// scroller per table is how a screen comes to have two. The caller owns the `ScrollView`;
// this owns the frame, the hairlines, the row height and the three states a list can be
// in.

// How tall a row is at least, whatever is in it. Set here and not per list: 44 is the
// floor for something a thumb aims at, and these rows are read on a phone with one hand.
const ROW_MIN_H = 'min-h-[44px]'

// How many stand-in rows a loading table draws. Four is what the shortest of these lists
// holds, so the frame never shrinks as the real rows arrive.
const SKELETON_ROWS = 4

// One column of every row: what it is called, how wide it is, and how a bare string in it
// is drawn.
export type AdminColumn = {
  // The caption over it. Left off by a column that needs none — the chevron's lane, or a
  // chip whose own word is the caption.
  label?: string
  // Fixed width in pixels. Absent is `flex-1`, and at most one column should be.
  width?: number
  align?: 'left' | 'right'
  // What a **string** cell in this column is: the thing the row is about (`name`), the
  // figure it came to (`figure`), or something said about it (`quiet`, the default). A
  // `ReactNode` cell passes through untouched — this only saves the lists wrapping every
  // plain word in the same `Text`.
  //
  // `figure` was asked for by the **analytics screen**, where every column but the first
  // is a number and all of them came out in secondary ink: a table of nothing but
  // secondary text has no hierarchy to read, and the figures are what the screen is for.
  // It is not the default, because the other lists put a *date* or a *status* in that
  // lane — said about the row rather than the point of it, and those stay quiet.
  tone?: 'name' | 'figure' | 'quiet'
}

export type AdminTableRow = {
  key: string
  // One per column, in order. A string is drawn by the column's `tone`; anything else is
  // drawn as it was handed over.
  cells: readonly ReactNode[]
  // Set by a row that does something when it is pressed. A row whose only action is a
  // button inside it — a feature's visibility — leaves this off.
  onPress?: () => void
  // Whether pressing it *goes somewhere* rather than doing something, which is the whole
  // of what the chevron says. The same word `CardButton` uses for the same distinction.
  // True by default, because most of these lists are lists of doors; the two stacks of
  // features set it false, since a row that toggles in place and a row that opens a
  // screen must not wear the same mark.
  leads?: boolean
  // Kept but past — an expired session, a message already answered. Still pressable: a
  // row nobody needs to read is still a row somebody needs to open.
  faded?: boolean
  // A second line under the row, spanning the whole of it: the warning on a row this
  // build has never heard of, the note under a feature, the text of a message. Inside the
  // row's own press target, so a field living here still takes its own taps first.
  note?: ReactNode
}

// A word in a cell that is a standing rather than a figure: a visibility, a session's
// status, a role. Here rather than in each list because every list had grown one, at
// three radii and two paddings.
//
// `filled` is the loud one and it carries `text-on-strong`, which is the only pair in the
// app proven to carry a label at this size. So a chip says *how far out* a thing has got
// by how solid it is, and never by a hue.
export function AdminChip({
  label,
  tone = 'quiet',
  icon,
  className,
}: {
  label: ReactNode
  // `quiet` is the hairline outline, `strong` the outlined-and-inked one, `filled` the
  // solid, `danger` the refusal — a row the server holds and this build does not, a
  // message still owed an answer.
  tone?: 'quiet' | 'strong' | 'filled' | 'danger'
  // Drawn before the label, inside the chip. The one caller is the LIVE chip on the
  // sessions list, whose mark is a dot that pulses — see `LiveDot`.
  icon?: ReactNode
  className?: string
}) {
  const box = {
    quiet: 'border-muted',
    strong: 'border-strong',
    filled: 'border-strong bg-strong',
    danger: 'border-red-500/40',
  }[tone]
  const ink = {
    quiet: 'text-dim',
    strong: 'text-primary',
    filled: 'text-on-strong',
    danger: 'text-red-500',
  }[tone]
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-md border px-1.5 py-0.5',
        box,
        className,
      )}
    >
      {icon}
      <Text selectable={false} className={cn(TYPE.rowLabel, ink)}>
        {label}
      </Text>
    </View>
  )
}

// Whether a row wears the chevron: it has to do something, and that something has to be
// going somewhere.
const leadsOf = (row: AdminTableRow) => row.onPress !== undefined && (row.leads ?? true)

// On or off, as a target rather than a glyph. The two stacks of features — a role's and a
// person's — said this with ● and ○ at `TYPE.prose`, which is a 12px character to aim a
// thumb at and two shapes that do not share a centre at any size.
//
// A tick and not a platform `Switch`: a switch promises its own write the moment it
// moves, and these rows write through a round trip that can be refused. A box that is
// either ticked or empty says what the server holds, which is the thing being shown.
export function AdminTick({ on }: { on: boolean }) {
  return (
    <View
      className={cn(
        'h-[22px] w-[22px] items-center justify-center rounded-md border-2',
        on ? 'border-strong bg-strong' : 'border-muted',
      )}
    >
      {on && <Ionicons name="checkmark" size={14} color={ON_STRONG_INK} />}
    </View>
  )
}

function Cell({ column, children }: { column: AdminColumn; children: ReactNode }) {
  return (
    <View
      className={cn(
        column.width === undefined && 'flex-1',
        column.align === 'right' ? 'items-end' : 'items-start',
      )}
      style={column.width === undefined ? undefined : { width: column.width }}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          selectable={false}
          numberOfLines={1}
          className={cn(
            column.tone === 'name' ? TYPE.prose : TYPE.value,
            // A name and a figure are both the row's own content and carry primary ink;
            // everything else is an aside about it.
            column.tone === 'name' || column.tone === 'figure'
              ? 'text-primary'
              : 'text-dim',
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

function Row({
  row,
  columns,
  rowId,
  first,
}: {
  row: AdminTableRow
  columns: readonly AdminColumn[]
  rowId?: ButtonId
  // Whether this is the first row under the header, which is the one that does not carry
  // a hairline of its own — the header already drew the line above it.
  first: boolean
}) {
  const body = (
    <>
      <View className={cn('flex-row items-center gap-2', ROW_MIN_H)}>
        {columns.map((column, index) => (
          <Cell key={index} column={column}>
            {row.cells[index]}
          </Cell>
        ))}
        {/* The mark that says this row is a door. Drawn for a row that leads somewhere
            and for no other, so the lane is never held open by a list whose rows only
            toggle. */}
        {leadsOf(row) && <Ionicons name="chevron-forward" size={13} color={DIM_INK} />}
      </View>
      {row.note !== undefined && <View className="pb-2">{row.note}</View>}
    </>
  )

  const shell = cn('px-2.5', !first && 'border-t border-muted', row.faded && 'opacity-50')

  // A row is pressable only if the table said what a press of it is called. Not a
  // defensive check: the id is the whole reason `TrackedPressable` exists, and a table of
  // figures that nobody can press — the analytics screen has two — should not have to
  // invent a funnel name to be drawn.
  return row.onPress === undefined || rowId === undefined ? (
    <View className={shell}>{body}</View>
  ) : (
    <TrackedPressable id={rowId} onPress={row.onPress} className={shell}>
      {body}
    </TrackedPressable>
  )
}

export function AdminTable({
  columns,
  rows,
  rowId,
  loading = false,
  error = null,
  empty,
  footer,
  className,
}: {
  columns: readonly AdminColumn[]
  rows: readonly AdminTableRow[]
  // What a press of any row reports. One id per list, because a list is one funnel — the
  // same arrangement `admin.session` and `admin.person` already had. Left off by a table
  // whose rows do nothing when pressed, which is what the analytics screen's two are.
  rowId?: ButtonId
  loading?: boolean
  // Shown inside the frame, where the rows would be: a list that could not be read is
  // still that list, and a sentence floating above an empty card says less.
  error?: string | null
  // What to say when the read succeeded and there is nothing in it.
  empty?: ReactNode
  // A block under the last row, inside the frame.
  footer?: ReactNode
  // Placement only — a margin, a `flex-1`. Never the frame.
  className?: string
}) {
  const captioned = columns.some((column) => column.label !== undefined)
  return (
    <View
      className={cn(
        'overflow-hidden rounded-xl border border-muted bg-surface',
        className,
      )}
    >
      {captioned && (
        <View className="flex-row items-center gap-2 border-b border-muted bg-card px-2.5 py-1.5">
          {columns.map((column, index) => (
            <Cell key={index} column={column}>
              <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
                {column.label ?? ''}
              </Text>
            </Cell>
          ))}
          {/* The chevron's lane, held open in the header so the captions over the last
              column sit where that column actually is. */}
          {rows.some(leadsOf) && <View className="w-[13px]" />}
        </View>
      )}

      {loading ? (
        <SkeletonPulse>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <View
              key={index}
              className={cn(
                'flex-row items-center gap-2 px-2.5',
                ROW_MIN_H,
                index > 0 && 'border-t border-muted',
              )}
            >
              <SkeletonBar className="h-3 flex-1" />
              <SkeletonBar className="h-3 w-10" />
            </View>
          ))}
        </SkeletonPulse>
      ) : error !== null ? (
        <View className={cn('justify-center px-2.5', ROW_MIN_H)}>
          <Text selectable={false} className={cn(TYPE.value, 'text-red-500')}>
            {error}
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View className={cn('justify-center px-2.5', ROW_MIN_H)}>
          <Text selectable={false} className={cn(TYPE.value, 'text-dim')}>
            {empty}
          </Text>
        </View>
      ) : (
        rows.map((row, index) => (
          <Row
            key={row.key}
            row={row}
            columns={columns}
            rowId={rowId}
            first={index === 0 && !captioned}
          />
        ))
      )}

      {footer !== undefined && (
        <View className="border-t border-muted bg-card px-2.5 py-2">{footer}</View>
      )}
    </View>
  )
}

import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { RecapCard } from '@/components/overlays/recap-card'
import { weekForShape } from '@/dev/weekly-recap/facts'
import { minusDays, nextDay } from '@/lib/leaderboard-period'
import type { ShapeKind } from '@/lib/recap'

// The weekly recap as it arrives: one card in the launch popup, on the first open of a new
// week.
//
// Dev-only, and the two controls under the card are not part of the design — a shipped
// recap is seeded on the week's Monday and never changes under the player. They are here
// because the question this prototype exists to answer is whether the phrasings hold up
// across many weeks, and that cannot be read one fixed week at a time.
//
// A real Monday, so the window label under the title is a real window.
const BASE_MONDAY = '2026-09-21'

export function WeeklyRecapOverlay({
  kind,
  onDismiss,
}: {
  kind: ShapeKind
  onDismiss: () => void
}) {
  // Two dials, because they answer different questions: a new week changes what happened, a
  // new phrasing changes only how the same week is told. REPHRASE walks the window back a
  // week at a time rather than poking the seed directly — the seed *is* the Monday, and a
  // dev control that could set the two apart would be showing something production cannot.
  const [week, setWeek] = useState(0)
  const [phrasing, setPhrasing] = useState(0)

  const facts = useMemo(() => weekForShape(kind, `${kind}-${week}`), [kind, week])

  const from = minusDays(BASE_MONDAY, phrasing * 7)
  // The Sunday that closes it — six days on, the way every real window is drawn.
  let to = from
  for (let i = 0; i < 6; i++) to = nextDay(to)

  return (
    <ModalCard title="WHAT’S NEW" onDismiss={onDismiss}>
      {(close) => (
        <>
          <View className="py-2">
            {facts === null ? (
              <Text
                selectable={false}
                className="py-6 text-center font-mono text-[11px] font-bold tracking-[1px] text-dim"
              >
                NO {kind.toUpperCase()} WEEK FOUND
              </Text>
            ) : (
              <RecapCard facts={facts} from={from} to={to} />
            )}
          </View>

          <View className="mt-1 flex-row items-center justify-center gap-2 border-t border-muted pt-3">
            <Text
              selectable={false}
              className="mr-auto font-mono text-[9px] font-bold tracking-[1px] text-dim"
            >
              {kind.toUpperCase()}
            </Text>
            <Pressable
              onPress={() => {
                setWeek((current) => current + 1)
              }}
              className="rounded-xl bg-card px-3 py-2"
            >
              <Text
                selectable={false}
                className="font-mono text-[9px] font-bold tracking-[1px] text-primary"
              >
                NEW WEEK
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPhrasing((current) => current + 1)
              }}
              className="rounded-xl bg-card px-3 py-2"
            >
              <Text
                selectable={false}
                className="font-mono text-[9px] font-bold tracking-[1px] text-primary"
              >
                REPHRASE
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={close}
            className="mt-3 items-center rounded-2xl bg-strong px-6 py-3.5"
          >
            <Text
              selectable={false}
              className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
            >
              GOT IT
            </Text>
          </Pressable>
        </>
      )}
    </ModalCard>
  )
}

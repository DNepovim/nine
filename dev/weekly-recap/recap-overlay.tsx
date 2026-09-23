import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { composeRecap, weekForShape, type ShapeKind } from '@/dev/weekly-recap/recap'
import { RecapCard } from '@/dev/weekly-recap/recap-card'

// The weekly recap as it would arrive: one card in the What's New popup, on the first
// open of a new week.
//
// Dev-only. The two controls under the card are not part of the design — a shipped recap
// is seeded on the week's Monday and never changes under the player. They are here
// because the question this prototype exists to answer is whether the phrasings hold up
// across many weeks, and that cannot be read one fixed week at a time.
const PERIOD = '22 – 28 SEPTEMBER'

export function WeeklyRecapOverlay({
  kind,
  onDismiss,
}: {
  kind: ShapeKind
  onDismiss: () => void
}) {
  // Two dials, because they answer different questions: a new week changes what happened,
  // a new phrasing changes only how the same week is told.
  const [week, setWeek] = useState(0)
  const [phrasing, setPhrasing] = useState(0)

  const recap = useMemo(() => {
    const facts = weekForShape(kind, `${kind}-${week}`)
    if (facts === null) return null
    return composeRecap(facts, `${kind}-${week}-${phrasing}`)
  }, [kind, week, phrasing])

  return (
    <ModalCard title="WHAT’S NEW" onDismiss={onDismiss}>
      {(close) => (
        <>
          <View className="py-2">
            {recap === null ? (
              <Text
                selectable={false}
                className="py-6 text-center font-mono text-[11px] font-bold tracking-[1px] text-dim"
              >
                NO {kind.toUpperCase()} WEEK FOUND
              </Text>
            ) : (
              <RecapCard sentences={recap.sentences} period={PERIOD} />
            )}
          </View>

          <View className="mt-1 flex-row items-center justify-center gap-2 border-t border-muted pt-3">
            <Text
              selectable={false}
              className="mr-auto font-mono text-[9px] font-bold tracking-[1px] text-dim"
            >
              {recap === null ? kind.toUpperCase() : recap.shape.kind.toUpperCase()}
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

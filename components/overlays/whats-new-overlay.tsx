import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { useState, type ComponentProps } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import {
  popupAccent,
  PopupCardView,
  popupPrimary,
  popupTitle,
} from '@/components/overlays/popup-card-view'
import { PageDots } from '@/components/page-dots'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useViewport } from '@/hooks/use-viewport'
import { cn } from '@/lib/cn'
import type { PopupCard } from '@/types/popup'

// A dialog, not a screen: as tall as its content, capped so a long page scrolls rather
// than running off the display.
//
// Pages of more than one kind since winnings arrived — what you won while you were away,
// then what changed in the app. One dialog with two pages rather than two dialogs in a
// row, which is what a Monday would otherwise be.

// What the one button wears. A tick rather than an arrow for an accept: the press settles
// something, and the mark that says so should not also be the mark that means "onwards".
type ButtonMark = 'accept' | 'next' | 'done'

const ICONS = {
  accept: 'checkmark',
  next: 'arrow-forward',
  done: 'play',
} as const satisfies Record<ButtonMark, ComponentProps<typeof Ionicons>['name']>

export function WhatsNewOverlay({
  cards,
  onDismiss,
  onAccept,
}: {
  cards: readonly PopupCard[]
  onDismiss: () => void
  // Turns what the winnings page is offering into fortune. Fired by the dialog's own
  // button, because that page borrows it — see `popupPrimary`.
  onAccept: () => void
}) {
  const [index, setIndex] = useState(0)
  const { height } = useViewport()

  const card = cards[index]
  if (card === undefined) return null

  const accent = popupAccent(card)
  const primary = popupPrimary(card)
  const isFirst = index === 0
  const isLast = index === cards.length - 1
  const mark: ButtonMark = primary !== null ? 'accept' : isLast ? 'done' : 'next'

  return (
    <ModalCard
      closeButton={false}
      title={popupTitle(card)}
      onDismiss={onDismiss}
      maxHeight={height * 0.85}
    >
      {(close) => (
        <>
          {/* flexShrink lets a long body scroll while a short one stays its own
                height — without it the ScrollView would claim the whole cap. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingVertical: 8 }}
          >
            <PopupCardView card={card} />
          </ScrollView>

          {cards.length > 1 && (
            <View className="mt-3">
              <PageDots
                total={cards.length}
                current={index}
                color={accent}
                onSelect={setIndex}
              />
            </View>
          )}

          <View className="mt-3 flex-row items-center justify-center gap-3">
            {cards.length > 1 && (
              <TrackedPressable
                id="news.action"
                onPress={() => {
                  setIndex((current) => current - 1)
                }}
                disabled={isFirst}
                className={cn(
                  'flex-row items-center gap-1 rounded-2xl bg-card px-4 py-3.5',
                  isFirst && 'opacity-[0.3]',
                )}
              >
                <Ionicons name="arrow-back" size={14} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
                  <Trans>BACK</Trans>
                </Text>
              </TrackedPressable>
            )}

            {/* One button, whatever the page is asking for. The winnings page lends it
                its own label and takes the press as an accept; every other page leaves it
                saying what it always said.

                The page advances on the press whether or not the accept lands. A request
                that failed is not something to hold the player on — it would make the one
                button on the page stop working with nothing on screen saying why — and an
                accept that did not land leaves the reward where it was for the next launch
                to offer again. What does *not* advance is the card's claim to have been
                paid: `useWinnings` flips that only once the write has returned clean.

                `closeButton={false}` above removes the CLOSE button under the content, not
                the 5-dot close in the card's header, which `ModalCard` always draws. That
                and the dots are the other two ways off this page, and both are fine: they
                settle nothing. */}
            <PrimaryButton
              id={primary?.id ?? 'news.dismiss'}
              onPress={() => {
                if (primary !== null) onAccept()
                if (isLast) close()
                else setIndex((current) => current + 1)
              }}
              label={
                primary?.label ?? (isLast ? <Trans>LET’S GO</Trans> : <Trans>NEXT</Trans>)
              }
              icon={<Ionicons name={ICONS[mark]} size={14} color="#d8d2f4" />}
            />
          </View>
        </>
      )}
    </ModalCard>
  )
}

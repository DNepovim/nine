import { Trans } from '@lingui/react/macro'
import { SectionList, Text } from 'react-native'

import {
  ACHIEVEMENT_COUNT,
  ACHIEVEMENT_GROUPS,
  GROUP_LABELS,
  groupIds,
  type AchievementGroup,
  type AchievementId,
} from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { useViewport } from '@/hooks/use-viewport'
import { firstEarnedAt, idsOf, stagesOf } from '@/lib/achievement-store'
import type { AchievementStore } from '@/lib/achievement-store'
import { boardMarks, stageProgress, type AchievementFacts } from '@/lib/achievements'

import { AchievementRow } from './achievement-row'
import { ModalCard } from './modal-card'

type Section = { title: AchievementGroup; data: AchievementId[] }

const SECTIONS: Section[] = ACHIEVEMENT_GROUPS.map((group) => ({
  title: group,
  data: groupIds(group),
}))

// Everything there is to earn, grouped, with what the player holds picked out in green.
//
// A SectionList rather than a scroll of Views: the catalogue is only going to grow, and
// the headers have to stick for a list this long to be navigable at all.
//
// A dialog rather than the full screen it used to take over. It is opened from one line
// on the intro and closed straight back to it, which is what every other dialog in the
// app is for — and taking the screen made a glance at the list feel like leaving.
export function AchievementsOverlay({
  store,
  facts,
  onClose,
}: {
  store: AchievementStore
  // What the rules measure against, so a locked row can show how far along it is. The
  // same object the run itself is evaluated with — asking a second way is how a row
  // saying 340/1000 and a bar that just fired would come to disagree.
  facts: AchievementFacts
  onClose: () => void
}) {
  const { colorScheme } = useTheme()
  const { height } = useViewport()
  // One date per achievement, the earliest — a staged one shows when it first landed
  // and its pips say the rest.
  const earnedAt = new Map(idsOf(store).map((id) => [id, firstEarnedAt(store, id)]))

  return (
    <ModalCard
      title={<Trans>ACHIEVEMENTS</Trans>}
      icon={
        <Text selectable={false} className="text-[11px]">
          🏆
        </Text>
      }
      onDismiss={onClose}
      maxHeight={height * 0.85}
    >
      {() => (
        <>
          <Text
            selectable={false}
            className="mb-2 font-mono text-[10px] font-bold tracking-[1px] text-dim"
          >
            <Text style={{ color: ACHIEVEMENT_INK[colorScheme] }}>{earnedAt.size}</Text>
            {` OF ${ACHIEVEMENT_COUNT} EARNED`}
          </Text>

          {/* flexShrink lets the catalogue scroll inside the card's own height cap;
              flexGrow 0 keeps it from claiming the whole cap on a short list. The
              headers stick to the card's surface, so they need its background under
              them rather than the scrim's. */}
          <SectionList
            sections={SECTIONS}
            keyExtractor={(id) => id}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            renderSectionHeader={({ section }) => (
              <Text
                selectable={false}
                className="bg-surface pb-1 pt-4 font-mono text-[9px] font-black tracking-[2px] text-dim"
              >
                {GROUP_LABELS[section.title]}
              </Text>
            )}
            renderItem={({ item }) => (
              <AchievementRow
                id={item}
                earnedAt={earnedAt.get(item) ?? null}
                stages={stagesOf(store, item)}
                progress={stageProgress(item, facts)}
                boards={boardMarks(item, facts)}
              />
            )}
          />
        </>
      )}
    </ModalCard>
  )
}

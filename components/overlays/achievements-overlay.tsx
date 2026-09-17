import { Trans } from '@lingui/react/macro'
import { Pressable, SectionList, Text, View } from 'react-native'

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
import type { AchievementStore } from '@/lib/achievement-store'
import { progressOf, type AchievementFacts } from '@/lib/achievements'

import { AchievementRow } from './achievement-row'

type Section = { title: AchievementGroup; data: AchievementId[] }

const SECTIONS: Section[] = ACHIEVEMENT_GROUPS.map((group) => ({
  title: group,
  data: groupIds(group),
}))

// Everything there is to earn, grouped, with what the player holds picked out in green.
//
// A SectionList rather than a scroll of Views: the catalogue is only going to grow, and
// the headers have to stick for a list this long to be navigable at all.
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
  const earnedAt = new Map(store.map((entry) => [entry.id, entry.earnedAt]))

  return (
    <View className="absolute inset-0 bg-surface px-6 pb-6 pt-16" style={{ zIndex: 40 }}>
      <Text
        selectable={false}
        className="mb-1 font-mono text-[20px] font-black tracking-[3px] text-primary"
      >
        <Trans>ACHIEVEMENTS</Trans>
      </Text>
      <Text
        selectable={false}
        className="mb-6 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        <Text style={{ color: ACHIEVEMENT_INK[colorScheme] }}>{earnedAt.size}</Text>
        {` OF ${ACHIEVEMENT_COUNT} EARNED`}
      </Text>

      <SectionList
        sections={SECTIONS}
        keyExtractor={(id) => id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
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
            progress={progressOf(item, facts)}
          />
        )}
      />

      <Pressable
        onPress={onClose}
        className="mt-4 items-center self-center rounded-2xl bg-strong py-4"
        style={{ width: 224 }}
      >
        <Text
          selectable={false}
          className="font-mono text-[13px] font-black tracking-[2px] text-on-strong"
        >
          <Trans>DONE</Trans>
        </Text>
      </Pressable>
    </View>
  )
}

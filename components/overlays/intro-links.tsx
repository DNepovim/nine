import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { UnreadDot } from '@/components/overlays/unread-dot'
import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useFeedbackOwed } from '@/hooks/use-feedback-owed'
import { useFlag } from '@/hooks/use-flags'
import { useOpenProfile } from '@/hooks/use-profile-modal'
import { cn } from '@/lib/cn'
import { boardName, shouldBoast } from '@/lib/invite-message'
import { DIFFICULTIES, labelOf, type Difficulty, type ModeId } from '@/modes'

// The intro's footer: OPTIONS, SHARE and PROFILE, then HOW TO PLAY and ADMIN under them.
export function IntroLinks({
  userId,
  gameMode,
  difficulty,
  bestScore,
  onOpenAdvanced,
  onShare,
  onHowToPlay,
  onOpenAdmin,
}: {
  userId: string | null
  gameMode: ModeId
  difficulty: Difficulty
  bestScore: number
  onOpenAdvanced: () => void
  onShare: (invite: string) => void
  onHowToPlay: () => void
  onOpenAdmin: () => void
}) {
  const { t } = useLingui()
  // The same function every name on a board calls. This screen's PROFILE link is the one
  // caller that does not open somebody else — it opens whoever is holding the phone.
  const openProfile = useOpenProfile()
  const showAdmin = useFlag('admin')
  // How many messages are waiting for an answer, which puts a dot on the link below.
  // Asked only of a launch that holds `admin` — the hook sees to that — because the
  // function behind it refuses anybody else.
  const feedbackOwed = useFeedbackOwed()

  return (
    <>
      {/* The two link rows are one block, and the air between them is a fraction of
        what separates the pair from PLAY GAME: they are the same footer read twice
        over, not two things the screen offers. */}
      <View className="items-center gap-3">
        <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <TrackedPressable id="menu.options" onPress={onOpenAdvanced} hitSlop={10}>
            <View className="flex-row items-center gap-1">
              <Ionicons name="settings-outline" size={10} color={DIM_INK} />
              <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                <Trans>OPTIONS</Trans>
              </Text>
            </View>
          </TrackedPressable>
          <TrackedPressable
            id="menu.board"
            onPress={() => {
              // The sentence lives here rather than in lib/ because it is the
              // one place that knows the active language; lib/ keeps the
              // decision and the board name, which are what a test can pin.
              const board = boardName(
                t(labelOf(gameMode)),
                t(DIFFICULTIES[difficulty].label),
              )
              const invite = shouldBoast(gameMode, bestScore)
                ? t`My best at Nine is ${bestScore} — ${board}. Think you can beat it?`
                : t`Nine buttons, one number to hit. Come take a run at it.`
              onShare(invite)
            }}
            hitSlop={10}
          >
            <View className="flex-row items-center gap-1">
              <Ionicons name="share-outline" size={10} color={DIM_INK} />
              <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                <Trans>SHARE</Trans>
              </Text>
            </View>
          </TrackedPressable>
          {/* The player's own card, from the screen they spend the most time on — the
          one place it was not reachable from, since every other door onto a profile
          is a name on a board and your own name is only there once you are on it.
          Last in the row: it is about the player rather than about the run, which
          is what the other two are.

          Only once the sign-in has landed. Before that there is no id to open, and
          a link that does nothing for the first second of a launch is worse than
          one that arrives a moment late. */}
          {userId !== null && (
            <TrackedPressable
              id="menu.profile"
              onPress={() => {
                openProfile(userId)
              }}
              hitSlop={10}
            >
              <View className="flex-row items-center gap-1">
                <Ionicons name="person-outline" size={10} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>PROFILE</Trans>
                </Text>
              </View>
            </TrackedPressable>
          )}
        </View>

        {/* A second row, under the one every player reads. HOW TO PLAY leads it and the
        admin link follows: the guide is not one of the three things the row above
        offers — those are about this screen, and it is about the game — and a row
        of its own is what stops the first one wrapping on a narrow phone now that
        it carries four.

        ADMIN is not for the player this screen otherwise addresses, and asks for
        its own feature — see constants/features.ts. The challenges lab, which had
        a DEV link of its own here, is reached from the admin hub. */}
        <View className="flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <TrackedPressable id="menu.how_to_play" onPress={onHowToPlay} hitSlop={10}>
            <View className="flex-row items-center gap-1">
              <Ionicons name="help-circle-outline" size={11} color={DIM_INK} />
              <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                <Trans>HOW TO PLAY</Trans>
              </Text>
            </View>
          </TrackedPressable>
          {showAdmin && (
            <TrackedPressable id="menu.admin" onPress={onOpenAdmin} hitSlop={10}>
              {/* `relative`, for the badge: messages players sent in that nobody has
                answered, counted, and this link is the only route to them. The one
                thing on the intro that is a task rather than a door — see
                `UnreadDot`, and `useFeedbackOwed`, which asks nothing at all of a
                launch that does not hold this key. */}
              <View className="relative flex-row items-center gap-1">
                <Ionicons name="shield-outline" size={10} color={DIM_INK} />
                <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
                  <Trans>ADMIN</Trans>
                </Text>
                {feedbackOwed > 0 && <UnreadDot count={feedbackOwed} />}
              </View>
            </TrackedPressable>
          )}
        </View>
      </View>
    </>
  )
}

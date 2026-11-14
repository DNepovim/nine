import { StatusBar } from 'expo-status-bar'
import { lazy, Suspense } from 'react'

import { ArcadeGame } from '@/components/game/arcade-game'
import { GameLayer } from '@/components/game/game-layer'
import { MultiplayerScreens } from '@/components/game/multiplayer-screens'
import { RunCelebrations } from '@/components/game/run-celebrations'
import { RunOverlays } from '@/components/game/run-overlays'
import { IntroMenuLayer } from '@/components/overlays/intro-menu-layer'
import { LaunchAsksLayer } from '@/components/overlays/launch-asks-layer'
import { MenuDialogs } from '@/components/overlays/menu-dialogs'
import { TitleDialogs } from '@/components/overlays/title-dialogs'
import { RolePreviewBadge } from '@/components/role-preview-badge'
import { SurfaceWash } from '@/components/surface-wash'
import { BoardProvider } from '@/hooks/use-board'
import { ChampionsProvider } from '@/hooks/use-champions'
import { FlagsProvider } from '@/hooks/use-flags'
import { useIntroStanding } from '@/hooks/use-intro-standing'
import { useLaunchAsks } from '@/hooks/use-launch-asks'
import { useLifeLoss } from '@/hooks/use-life-loss'
import { LocaleGate } from '@/hooks/use-locale'
import { usePlayField } from '@/hooks/use-play-field'
import { usePlayerAccount } from '@/hooks/use-player-account'
import { PlayerProfileProvider } from '@/hooks/use-profile-modal'
import { useRunAnnouncements } from '@/hooks/use-run-announcements'
import { useRunBoards } from '@/hooks/use-run-boards'
import { useRunControl } from '@/hooks/use-run-control'
import { useRunEnding } from '@/hooks/use-run-ending'
import { useRunSession } from '@/hooks/use-run-session'
import { SchemeProvider } from '@/hooks/use-scheme'
import { useScreenDialogs } from '@/hooks/use-screen-dialogs'

// The screen gallery's stage, in development only — the screen being looked at, drawn
// inside the app so it sees the real board store, champions, fonts and theme. Its picker
// lives outside the phone frame; see app/_layout.tsx.
//
// Loaded through a dynamic import inside a `__DEV__` ternary rather than imported at the
// top: babel-preset-expo folds `__DEV__` to false before Metro builds its dependency
// graph, so a production export drops the branch, the arrow that names the module, and
// therefore the module itself. A static import would be hoisted and shipped whatever the
// branch said.
//
// `import()` rather than `require()` because it carries its own types — `require`
// returns `any`, and typing that back would take either an assertion or a lint
// exemption, both of which this codebase does without.
const GalleryStage = __DEV__
  ? lazy(async () => {
      const mod = await import('@/dev/gallery')
      return { default: mod.GalleryStage }
    })
  : null

export default function GameScreen() {
  const control = useRunControl()
  const session = useRunSession({ control })
  const dialogs = useScreenDialogs({ control })
  const account = usePlayerAccount()
  const asks = useLaunchAsks({ control, dialogs, account })
  const boards = useRunBoards({ control, account })
  const announcements = useRunAnnouncements({
    control,
    session,
    dialogs,
    account,
    asks,
    boards,
  })
  const ending = useRunEnding({ control, account, asks, boards, announcements })
  const field = usePlayField({ control, boards, announcements, ending })
  const dying = useLifeLoss({ control, dialogs, field })
  const intro = useIntroStanding({ control, dialogs, account, asks, announcements })

  const { email, pendingEmail, rolePreview, shownFeatures, updateNickname, userId } =
    account
  const { board, champions } = boards
  const { accountEmail } = intro
  const { drag, opening } = control
  const { arcadeOpen, setArcadeOpen } = dialogs

  return (
    // Outermost, because what a player may be shown decides whether a door is drawn at
    // all — a question that comes before anything behind the door. Empty until auth has
    // answered, which for all but a handful of players is the answer; see use-flags.
    //
    // A role preview replaces the set here and nowhere else: this is the one place that
    // decides what is drawn, and a preview is a view rather than a grant. Every write is
    // still guarded on the server against the caller's own row.
    <FlagsProvider features={shownFeatures}>
      {/* Renders nothing. The language lives above the splash and the feature set
          arrives here, so this is where the two meet — see LocaleGate. */}
      <LocaleGate />
      {/* Every board on screen reads this one store, so the intro, the pause screen and
          the game over screen cannot show three different answers to the same question. */}
      <ChampionsProvider value={champions}>
        {/* Inside the champions provider: a profile wears the same crown or bird the row
          that opened it does, read from the one store rather than fetched again. */}
        <PlayerProfileProvider
          viewerId={userId}
          account={{
            email,
            pendingEmail,
            emailFlow: accountEmail,
            onRename: updateNickname,
          }}
        >
          <BoardProvider value={board}>
            {/* First of all, so the game and everything over it paints on the wash. */}
            <SchemeProvider kind={opening.scheme}>
              <SurfaceWash />
            </SchemeProvider>
            <StatusBar style={opening.statusBar} />

            <RunCelebrations
              control={control}
              announcements={announcements}
              field={field}
            />

            <GameLayer
              control={control}
              session={session}
              account={account}
              boards={boards}
              announcements={announcements}
              field={field}
              dying={dying}
            />

            <RunOverlays
              control={control}
              dialogs={dialogs}
              account={account}
              asks={asks}
              boards={boards}
              announcements={announcements}
              ending={ending}
              dying={dying}
              intro={intro}
            />

            <MenuDialogs
              control={control}
              session={session}
              dialogs={dialogs}
              account={account}
              asks={asks}
              intro={intro}
            />

            <LaunchAsksLayer
              control={control}
              dialogs={dialogs}
              asks={asks}
              intro={intro}
            />

            <IntroMenuLayer
              control={control}
              dialogs={dialogs}
              account={account}
              asks={asks}
              announcements={announcements}
              intro={intro}
            />

            <TitleDialogs
              control={control}
              dialogs={dialogs}
              account={account}
              asks={asks}
              announcements={announcements}
              dying={dying}
              intro={intro}
            />

            <MultiplayerScreens control={control} account={account} intro={intro} />

            {/* ── An arcade run. Over the intro rather than inside the game screen: the
                dial is the same dial, but what it is answering is a crossroad on a map,
                and none of the run above — the score, the lives, the board, the saved run
                — has anything to say about one. END takes it down, and taking it down
                ends the run. ── */}
            {arcadeOpen && (
              <ArcadeGame
                drag={drag}
                onEnd={() => {
                  setArcadeOpen(false)
                }}
              />
            )}

            {/* Last child and explicitly stacked: every overlay above is absolutely
              positioned and opaque, so a stage mounted earlier draws underneath the
              screen it is meant to be showing. Renders nothing until the picker on the
              desk outside the frame chooses something.
              The stacking lives on the stage's own view rather than on a wrapper here.
              A wrapper is mounted whether or not a screen is chosen, and a full-bleed
              absolute view at zIndex 100 over the whole app takes every press — which
              in a dev build left nothing on the screen clickable at all. */}
            {GalleryStage !== null && (
              <Suspense fallback={null}>
                <GalleryStage />
              </Suspense>
            )}

            {/* ── Which role the app is being drawn as, and the way back out ──
                Last child and above every layer: a preview of a role without `admin` has
                taken away the link that started it, so this badge is the only way back.
                Not inside any screen, because the preview is looked at from all of them. */}
            {rolePreview.preview !== null && (
              <RolePreviewBadge
                label={rolePreview.preview.label}
                onExit={rolePreview.stop}
              />
            )}
          </BoardProvider>
        </PlayerProfileProvider>
      </ChampionsProvider>
    </FlagsProvider>
  )
}

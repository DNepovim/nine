import { Trans, useLingui } from '@lingui/react/macro'

import { HowToPlayBody } from '@/components/overlays/how-to-play-body'
import { HowToPlayBullet } from '@/components/overlays/how-to-play-bullet'
import { HowToPlayCard } from '@/components/overlays/how-to-play-card'
import { HowToPlaySectionHeader } from '@/components/overlays/how-to-play-section-header'
import { GAME_SCALE } from '@/constants/colors'
import type { SectionKey } from '@/lib/how-to-play-sections'

// The guide's ARCADE section — see `HowToPlayOverlay`, which lays the sections out in order.
export function HowToPlayArcade({
  onMeasure,
}: {
  // Where this section's header sits in the guide's scroll, for the contents list to jump to.
  onMeasure: (section: SectionKey, y: number) => void
}) {
  const { t } = useLingui()
  return (
    <>
      <HowToPlaySectionHeader section="arcade" onMeasure={onMeasure} />
      <HowToPlayBody>
        {t`Pick ADVENTURE on the start screen. The dial is the same dial — but the targets are not scattered any more. Two to four of them hang at the ends of ways out of the crossroad you are standing on, and the one you dial is the one you walk.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Dial any target at the crossroad and you take that way. The ways you refused
            wither behind you.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Some roads have bandits on them, and nothing says so the first time. The hero
            is stopped partway along and a band of them closes in from every side, each
            carrying a number — dial one to cut that man down. They come in off the edges
            of the screen, so the whole band can be read before the nearest of them
            arrives. Let one reach you and it costs a heart, and you are driven back to
            the crossroad you set off from. Clear the road and you walk on, and it may be
            carrying food or a heart for you.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            A road you were driven off is marked with crossed sabres from then on, so you
            can see the toll before you choose it again. The men you cut down stay down,
            so the second run at it is a shorter fight — and a road cleared is clear for
            the rest of the run.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Every village holds out for its own length of time, and the ring drawn around
            its number is what is left of it. They are not the same: the one you want may
            be the one about to go.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            A village whose ring runs out withers off the fan, taking the way to it with
            it, and stops answering the dial. The others stay — you are only dragged back
            when the last of them gives up, which is what the red creeping along the way
            behind you is counting down to.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Answer while most of that clock is still full and you strike: the hero does
            not stop at the next crossroad, it rockets through and lands one deeper.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            When the red reaches you it drags you back one crossroad — and the ways you
            find there are the ones you left.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Get dragged back off the first crossroad and you fall into the mouth, and the
            run is over.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Every target is a village with a name, and the country between them is drawn
            as you climb: farmland, then forest, then hills, then mountains.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            The map turns as you walk, to keep you pointed forward. Tap the compass in the
            corner if you would rather north stayed at the top of the screen — it
            remembers whichever you chose.
          </Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      {/* The siege. Four things a player cannot safely find out by playing: that a
          wall is a fight, that a tower is chipped by arriving at its number rather
          than sitting on it, that a route of exactly par brings the whole tower
          down — which is the one thing in the mode that pays for reading rather
          than hurrying, and which nothing on the screen announces — and that a
          walled village is the only food on the map, which is what turns the fight
          from a risk worth avoiding into the thing a hungry run has to walk
          toward. */}
      <HowToPlayBody>
        {t`\nSome villages have walls, and the two are drawn as two different places — an open village is a scatter of houses, a church and a hall with nothing around them, a walled one is a dark ring of wall with a tower at each corner and a pennant flying over it. Dial toward the walls and you do not walk in. You take it. Three hearts sit on the bar under ADVENTURE, and a siege is the fastest way to spend them. Taking a village always gives one back; clearing a road of bandits sometimes does.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            The hero halts well short of the gate, with the walls across the top of the
            screen and open ground between. Every tower on them carries a number, and so
            does every warrior who comes out of the gate.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            A tower takes a few hits, and a hit means arriving at its number. Every hit it
            survives it takes a new number, so a tower is several journeys across the dial
            rather than one answer found and then repeated.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Reach a tower’s number by the shortest route there is and the whole tower
            comes down at once, however many hits it had left. Waste a move getting there
            and you only chip it. Reading the wall is worth more than hurrying at it.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Warriors leave the gate one at a time, and faster the longer the fight drags
            on. Dial a warrior’s number and he is gone. Let one reach you and it costs a
            heart. There is no way out of a siege but winning it, so look at the walls
            before you dial that way.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Flatten every tower and the village is yours — the walls come down, a heart
            comes back, up to three again, and you eat your fill.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Out of hearts and the run is over. That and the mouth are the only two ways
            one ends.
          </Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      {/* Satiety. The one rule a player cannot read off the screen: that the
          loaves are spent by *walking* rather than by time, and that how well a
          crossroad was answered is what decides the size of the bite. Everything
          else about it — that it is low, that it is red, that a heart just went —
          the row says for itself, which is most of why it is loaves and no longer
          a bar.

          What is written down is the arithmetic, because it is the half a player
          can plan with and cannot count off the screen: half a loaf a walk when
          the route is tidy, a whole one when it is not. Five loaves then means ten
          careful walks or five careless ones, which is a sum worth doing before
          choosing a way rather than after. */}
      <HowToPlayBody>
        {t`\nThe hero eats. The five loaves beside the hearts are the stores, and every way you walk eats into them — half a loaf when you dialled the target in the fewest moves there are, a whole one when you wasted most of them, so the tidy route is the one that keeps you fed. Getting dragged back costs a whole loaf too.`}
      </HowToPlayBody>
      <HowToPlayCard>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            A walled village is the only full meal on the map. Take one and all five
            loaves come back — which is why a hungry run has to go looking for a fight
            rather than away from one. Bandits carry stores rather than a granary:
            clearing a road sometimes pays a loaf and a half, which is worth having and is
            never worth walking past a village for.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            The fight itself costs nothing to stand in. Dialling at towers and warriors
            leaves the loaves exactly as they were when the walls closed.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            The loaves tell you before they run out. Down to one and it turns orange; down
            to half of one and it turns red, which is one more careful walk and no
            careless ones.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Eat the last of them and the empty row starts to pulse: you are starving, and
            a heart goes every five seconds until you eat.
          </Trans>
        </HowToPlayBullet>
        <HowToPlayBullet color={GAME_SCALE[4]}>
          <Trans>
            Starving stops nothing else. The clock still runs, the dial still listens and
            the ways are still there — so an empty row is a reason to hurry toward walls,
            not a reason the run is over.
          </Trans>
        </HowToPlayBullet>
      </HowToPlayCard>
      <HowToPlayBody>
        {t`\nHow deep you got is the whole score: every way costs about the same number of moves, so what you are choosing is where to go, not what is cheaper. Villages taken is counted beside it on the cards, but it is a tally rather than points. There is no difficulty to pick — the clock tightens the deeper you climb, which is the only one the mode has.`}
      </HowToPlayBody>
    </>
  )
}

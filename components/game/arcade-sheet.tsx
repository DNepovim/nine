import Animated, { FadeIn } from 'react-native-reanimated'

import { AmbushField } from '@/components/game/ambush-field'
import { AmbushMark } from '@/components/game/ambush-mark'
import { ArcadeHero } from '@/components/game/arcade-hero'
import { ArcadeMouth } from '@/components/game/arcade-mouth'
import { ArcadeStrike } from '@/components/game/arcade-strike'
import { LandMark } from '@/components/game/land-mark'
import { SiegeField } from '@/components/game/siege-field'
import { VillageArrival } from '@/components/game/village-arrival'
import { WayBud } from '@/components/game/way-bud'
import { WayStem } from '@/components/game/way-stem'
import { DAWN_OUT_MS } from '@/constants/arcade'
import { ARCADE_INK, MAP_INK, PIE_INK, SURFACE, WAY_INK } from '@/constants/colors'
import type { useArcadeCamera } from '@/hooks/use-arcade-camera'
import type { useArcadeLand } from '@/hooks/use-arcade-land'
import type { ArcadeRun } from '@/hooks/use-arcade-run'
import type { ArcadeCanvas } from '@/lib/arcade-canvas'
import { pointsOf, type AmbushFrame } from '@/lib/arcade-layout'
import { gradientOf, lerpColor } from '@/modes'

const [EMBER, AMBER] = gradientOf('arcade')

const HERO_CORE = lerpColor(AMBER, '#FFFFFF', 0.62)

// The amber at a little under half, which is as much edge as a bud can take before the ring
// starts competing with the numeral inside it.
const BUD_EDGE = `${AMBER}73`

// ADVENTURE's map: the sheet, turned and panned by the camera, and everything on it — the
// country, the ways, the villages, a fight, the hero. See `ArcadeGame` for the screen
// round it, `useArcadeCamera` for how it moves and `canvasOf` for what is on it.
export function ArcadeSheet({
  run,
  drawn,
  camera,
  land,
  pitch,
  box,
  canvasWidth,
  anchorX,
  anchorY,
  ground,
}: {
  run: ArcadeRun
  drawn: ArcadeCanvas
  camera: ReturnType<typeof useArcadeCamera>
  land: ReturnType<typeof useArcadeLand>
  pitch: number
  // The square each way's drawing is laid in.
  box: number
  canvasWidth: number
  // Where the destination lands on the canvas — the point the sheet turns about.
  anchorX: number
  anchorY: number
  // The road an ambush's band stands on — see `ambushFrame`.
  ground: AmbushFrame['ground']
}) {
  const here = run.standing
  const {
    stems,
    buds,
    waylaid,
    stub,
    nearMouth,
    mouthFade,
    dawn,
    leaving,
    skipped,
    hero,
    stand,
  } = drawn
  const { clock, now, camTurn, progress, sheetTurn, sheetPan, country, sheet } = camera
  return (
    <>
      {!dawn && (
        <Animated.View
          entering={FadeIn.duration(DAWN_OUT_MS)}
          // No size, and sitting on the anchor: a view's transform turns about its own
          // centre, so this is the one place the sheet can be turned from.
          style={[
            {
              position: 'absolute',
              left: anchorX,
              top: anchorY,
              width: 0,
              height: 0,
            },
            sheetTurn,
          ]}
        >
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, sheetPan]}>
            {/* The map the run is climbing: the country, the ways out of here, the
            ways behind and the villages at their ends. All of it one group, because
            all of it steps back together while a siege is on — what is left at full
            strength is the hero and the village it is standing under, which is the
            whole of what there is to look at by then. */}
            <Animated.View className="absolute left-0 top-0" style={country}>
              {/* The country, under the ways and over nothing. Each feature is its
              own small SVG so it can arrive on its own and leave once the hero has
              walked far enough that nobody is looking at it. */}
              {land.map((feature) => (
                <LandMark
                  key={feature.key}
                  feature={feature}
                  pitch={pitch}
                  sheet={sheet}
                  line={MAP_INK.line}
                  hatch={MAP_INK.hatch}
                  knockout={SURFACE}
                />
              ))}
              {stems.map((stem) => (
                <WayStem
                  key={stem.key}
                  x={stem.x}
                  y={stem.y}
                  box={box}
                  spline={stem.spline}
                  sheet={sheet}
                  lit={stem.lit}
                  state={stem.state}
                  delay={stem.delay}
                  creepMs={stem.creepMs}
                  creepFrom={stem.creepFrom}
                  fade={stem.fade}
                  gradientId={stem.gradientId}
                  aheadInk={WAY_INK}
                  amber={AMBER}
                  ember={EMBER}
                />
              ))}
              {stub !== null && nearMouth && (
                <ArcadeMouth
                  x={stub.toX}
                  y={stub.toY}
                  sheet={sheet}
                  fade={mouthFade}
                  ring={MAP_INK.hatch}
                  ember={EMBER}
                />
              )}
              {buds.map((bud) => (
                <WayBud
                  key={bud.key}
                  x={bud.x}
                  y={bud.y}
                  value={bud.value}
                  name={bud.name}
                  named={bud.named}
                  seed={bud.seed}
                  state={bud.state}
                  delay={bud.delay}
                  fortified={bud.fortified}
                  endsAt={bud.endsAt}
                  clockMs={bud.clockMs}
                  now={now}
                  edge={BUD_EDGE}
                  ink={PIE_INK}
                  sheet={sheet}
                  line={MAP_INK.line}
                  hatch={MAP_INK.hatch}
                  face={SURFACE}
                />
              ))}
            </Animated.View>
            {waylaid.map((mark) => (
              <AmbushMark
                key={mark.key}
                x={mark.x}
                y={mark.y}
                sheet={sheet}
                face={SURFACE}
                line={MAP_INK.line}
              />
            ))}
            {skipped !== null && (
              <ArcadeStrike
                // Keyed on the beat, so each strike is its own word rather than one view
                // restarting — two in a row would otherwise share an animation.
                key={run.seq}
                x={skipped.fromX}
                y={skipped.fromY}
                sheet={sheet}
                ink={ARCADE_INK}
              />
            )}
            {/* The fight, over the ground it is fought on. Outside the group above,
            like the hero and the strike: the country steps back while a siege is on and
            the besieged village is the one thing left to look at. */}
            {run.siege !== null && here !== undefined && pitch > 0 && (
              <SiegeField
                siege={run.siege}
                now={now}
                turn={camTurn}
                villageX={pointsOf(here.pos, pitch).x}
                villageY={pointsOf(here.pos, pitch).y}
                heroX={hero.x + stand.x}
                heroY={hero.y + stand.y}
                width={canvasWidth}
                ink={PIE_INK}
                line={MAP_INK.line}
                hatch={MAP_INK.hatch}
                // The one red on this screen, which is arcade's own first stop. A
                // siege does not get a second — see the design guide.
                blood={EMBER}
                face={SURFACE}
              />
            )}
            {/* The men on the road, round the hero they are closing on. Outside the
            group above for the reason the siege's field is: the country steps back while
            a fight is on, and what is left to look at is the fight. */}
            {run.ambush !== null && pitch > 0 && (
              <AmbushField
                ambush={run.ambush}
                now={now}
                turn={camTurn}
                heroX={hero.x + stand.x}
                heroY={hero.y + stand.y}
                ground={ground}
                ink={PIE_INK}
                line={MAP_INK.line}
                face={SURFACE}
              />
            )}
            {/* The name of the place just reached, under the flame. Keyed on the crossroad,
            so arriving plays it once and walking on plays the next one rather than
            restarting this one. */}
            {here !== undefined && pitch > 0 && (
              <VillageArrival
                key={here.id}
                x={pointsOf(here.pos, pitch).x}
                y={pointsOf(here.pos, pitch).y}
                name={here.name}
                sheet={sheet}
                ink={ARCADE_INK}
              />
            )}
            <ArcadeHero
              originX={hero.x}
              originY={hero.y}
              spline={hero.spline}
              through={skipped?.spline ?? null}
              throughX={skipped?.x ?? 0}
              throughY={skipped?.y ?? 0}
              progress={progress}
              clock={clock}
              sheet={sheet}
              pitch={pitch}
              standing={!leaving}
              rocketing={run.phase === 'rocket'}
              amber={AMBER}
              ember={EMBER}
              core={HERO_CORE}
              smoke={MAP_INK.hatch}
            />
          </Animated.View>
        </Animated.View>
      )}
    </>
  )
}

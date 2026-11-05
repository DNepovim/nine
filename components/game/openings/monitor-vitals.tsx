import { useFonts } from 'expo-font'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import DSEG7Font from '@/assets/fonts/DSEG7Classic-Bold.ttf'
import { MONITOR } from '@/constants/colors'
import { mono } from '@/constants/theme'
import { READOUT, TYPE } from '@/constants/typography'
import { livingVitals, vitalsOf, type RunFigures } from '@/lib/vitals'

// The figures down the side of NO SLIP's monitor — pulse, pressure, oxygen, breathing and
// temperature — drawn dim behind the run, as a real monitor's are. They are read off how the
// run is going (`vitalsOf`): speed is the pulse, accuracy the oxygen, the streak the breath.
// Decoration, and never pressable.

// Where down the screen the row stands, as a share of its height: clear of the top bar and of
// the line across the middle.
const AT = 0.15
// How faint the whole row is, so it reads as part of the screen and not as something to read.
const FAINT = 0.42

function Reading({ label, value, face }: { label: string; value: string; face: string }) {
  const color = MONITOR.line
  return (
    <View className="items-center">
      <Text className={TYPE.sectionLabel} style={{ color, fontFamily: mono }}>
        {label}
      </Text>
      <Text className={READOUT.best} style={{ color, fontFamily: face }}>
        {value}
      </Text>
    </View>
  )
}

// How often the figures stir, in ms: a monitor's readings are refreshed, not streamed.
const STIR_MS = 1400

// `stir` is anything that changes when the patient should be read again — a press of a key. The
// figures also move on their own between presses.
export function MonitorVitals({
  figures,
  stir,
}: {
  figures: RunFigures
  stir?: unknown
}) {
  const [loaded] = useFonts({ DSEG7: DSEG7Font })
  const face = loaded ? 'DSEG7' : mono
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setBeat((last) => last + 1)
    }, STIR_MS)
    return () => {
      clearInterval(timer)
    }
  }, [])
  useEffect(() => {
    setBeat((last) => last + 1)
  }, [stir])
  const vitals = livingVitals(vitalsOf(figures), beat)
  return (
    <View
      className="absolute left-0 right-0 flex-row items-start justify-around px-4"
      style={{ top: `${AT * 100}%`, opacity: FAINT }}
      pointerEvents="none"
      aria-hidden
    >
      <Reading label="HR" value={String(vitals.heartRate)} face={face} />
      <Reading
        label="NIBP"
        value={`${vitals.pressure[0]}/${vitals.pressure[1]}`}
        face={face}
      />
      <Reading label="SPO2" value={String(vitals.oxygen)} face={face} />
      <Reading label="RESP" value={String(vitals.respiration)} face={face} />
      <Reading label="TEMP" value={vitals.temperature.toFixed(1)} face={face} />
    </View>
  )
}

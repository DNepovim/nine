import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'
import { Linking, Platform, Share, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { encode } from 'uqr'

import { GradientText } from '@/components/gradient-text'
import { LinkButton } from '@/components/link-button'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { TrackedPressable } from '@/components/tracked-pressable'
import { NAME_INK, ON_STRONG_INK, SPECTRUM, SURFACE } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { SHARE_URL } from '@/lib/invite-message'

// Big enough to scan from across a table, small enough to leave the card its button.
const QR_SIZE = 200

// The quiet zone round the code, in modules, and the tile's padding round that (`p-2`).
// Both are paper on paper — the tile is the card's own colour — so the eye measures the
// gap under the code from its last dark module, not from the tile's edge.
const QR_BORDER = 2
const TILE_PAD = 8

// The link as a phone sees it once it is scanned, without the scheme a reader skips.
const SHARE_HOST = SHARE_URL.replace(/^https?:\/\//, '')

// Every dark module as one path, so a code of a few hundred squares is one native view
// rather than hundreds. The quiet zone is uqr's own border, drawn in the tile's paper.
function qrPath(url: string): { d: string; size: number } {
  const { data, size } = encode(url, { ecc: 'M', border: QR_BORDER })
  const d = data
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .join('')
  return { d, size }
}

// What SHARE on the intro opens: the game's address as a QR code for the phone across
// the table, and the system sheet one press further for everyone else.
//
// A code first, because the person you are inviting is usually sitting next to you —
// pointing their camera at this screen opens the game on their phone with nothing typed
// and nothing sent through a chat. The sheet is still here for a friend who is not, and
// on iOS it is also the AirDrop door.
export function ShareModal({
  invite,
  onDismiss,
}: {
  // The sentence the sheet sends with the link, written on the intro where the board and
  // the best score are known.
  invite: string
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const qr = useMemo(() => qrPath(SHARE_URL), [])
  // Drawn back up by the paper under the code, so the address sits the column's own gap
  // from the last dark module — the same gap it has to the button below.
  const paperUnderCode = TILE_PAD + (QR_BORDER * QR_SIZE) / qr.size

  return (
    <ModalCard title={t`SHARE NINE`} onDismiss={onDismiss} closeButton={false}>
      {(close) => (
        <View className="items-center gap-4 py-2">
          <View className="rounded-2xl p-2" style={{ backgroundColor: SURFACE }}>
            <Svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${qr.size} ${qr.size}`}>
              {/* The game's spectrum corner to corner, the way the splash paints it. The
                  blue end is the lightest ink in it and still reads to a phone camera
                  against the tile's paper. */}
              <Defs>
                <LinearGradient id="qr" x1="0" y1="0" x2="1" y2="1">
                  {SPECTRUM.map((color, index) => (
                    <Stop
                      key={color}
                      offset={index / (SPECTRUM.length - 1)}
                      stopColor={color}
                    />
                  ))}
                </LinearGradient>
              </Defs>
              <Path d={qr.d} fill="url(#qr)" />
            </Svg>
          </View>
          {/* In the name inks rather than the spectrum: those are the spectrum's ends tuned
              to carry a word, which the fill stops are not. */}
          {/* Pressable too, for the person holding the phone: it opens the game in the
              browser, which is the quickest way to check the code goes where it says. */}
          <TrackedPressable
            id="share.link"
            accessibilityRole="link"
            hitSlop={8}
            style={{ marginTop: -paperUnderCode }}
            onPress={() => {
              void Linking.openURL(SHARE_URL)
            }}
          >
            <GradientText
              text={SHARE_HOST}
              from={NAME_INK[0]}
              to={NAME_INK[1]}
              className={TYPE.button}
            />
          </TrackedPressable>
          <PrimaryButton
            id="share.system"
            className="self-stretch"
            onPress={() => {
              // iOS takes the link as its own item, so the sheet can offer it to AirDrop
              // and Copy Link; Android ignores `url` and needs it inline.
              void Share.share(
                Platform.OS === 'ios'
                  ? { message: invite, url: SHARE_URL }
                  : { message: `${invite}\n\n${SHARE_URL}` },
              )
            }}
            label={<Trans>SEND A LINK</Trans>}
            icon={<Ionicons name="share-outline" size={14} color={ON_STRONG_INK} />}
          />
          {/* A link rather than the card's own CLOSE: SEND A LINK is the button here, and
              a second full-width one under it would weigh the same. */}
          <LinkButton
            id="shared.dialog_close"
            onPress={close}
            icon="close-outline"
            label={<Trans>CLOSE</Trans>}
          />
        </View>
      )}
    </ModalCard>
  )
}

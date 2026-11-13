import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import { ScrollView } from 'react-native'

import { AdminScreen } from '@/components/overlays/admin-screen'
import { AdminSegments } from '@/components/overlays/admin-segments'
import { KnowledgeFortune } from '@/components/overlays/knowledge-fortune'
import { KnowledgeMechanics } from '@/components/overlays/knowledge-mechanics'
import { KnowledgeSecrets } from '@/components/overlays/knowledge-secrets'
import { PrimaryButton } from '@/components/primary-button'

// How things are counted, as formulas: the fifth door off the admin hub, and the only one
// that reads nothing from the server. A reference for whoever answers players, not a
// guide for players — so a line is a formula and a short note, never a paragraph.
//
// **Every figure is worked out, not typed.** The weights come off `DIFFICULTIES`, the
// podium off `winFactor`, the clocks off `runRules` and the ramp — so retuning a mode
// retunes this screen with it. Two exceptions, both priced in SQL with no client copy to
// read: a session's podium shares (`session_podium_share`) and its grace
// (`session_score_grace`). Those are written out on the FORTUNE page
// (`knowledge-fortune.tsx`) and have to move with them.
type Page = 'fortune' | 'secrets' | 'mechanics'

const PAGES: readonly Page[] = ['fortune', 'secrets', 'mechanics']

const PAGE_LABEL = {
  fortune: msg`FORTUNE`,
  secrets: msg`SECRETS`,
  mechanics: msg`MECHANICS`,
} as const

const TITLE = msg`KNOWLEDGE`

const PAGE_BODY: Record<Page, () => ReactNode> = {
  fortune: KnowledgeFortune,
  secrets: KnowledgeSecrets,
  mechanics: KnowledgeMechanics,
}

export function AdminKnowledge({ onBack }: { onBack: () => void }) {
  const { t } = useLingui()
  const [page, setPage] = useState<Page>('fortune')
  const Body = PAGE_BODY[page]

  return (
    <AdminScreen
      title={t(TITLE)}
      footer={
        <PrimaryButton id="admin.back" onPress={onBack} label={<Trans>BACK</Trans>} />
      }
    >
      <AdminSegments
        id="admin.tab"
        className="mb-2.5"
        value={page}
        onSelect={setPage}
        options={PAGES.map((option) => ({ value: option, label: t(PAGE_LABEL[option]) }))}
      />
      {/* Keyed by the page so a switch starts at the top rather than wherever the last
          page was scrolled to. */}
      <ScrollView key={page} showsVerticalScrollIndicator={false}>
        <Body />
      </ScrollView>
    </AdminScreen>
  )
}

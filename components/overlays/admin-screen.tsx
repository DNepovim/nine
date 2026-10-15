import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { ScreenLayer } from '@/components/screen'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The chrome every admin screen is built in: the padding, the heading, the one place a
// refused write is reported, and the footer the way out sits in.
//
// Eight screens had grown the same four lines — a screen title, a subtitle, a red line
// for the error, a button at the bottom — and they had already drifted: two put the error
// above the list and two below it, the hub left the subtitle off, and the planner's BACK
// sat in a centring `View` while the others used `self-center`. This is that shape, once.
//
// **No back arrow and no subtitle.** Both were here and both were taken out: the subtitle
// repeated what the hub tile that opened the screen had just said, and the arrow was a
// second way out two lines above the first — these screens end in BACK, which is a
// 44px-tall button rather than a chevron in a corner. What the heading does now is name
// where you are, in one line.
//
// The way out is a **footer slot** rather than a prop, because it is DONE on a detail
// screen, BACK on a list and both on one — what they have in common is where they sit,
// which is the only part worth holding still.

// The heading of an admin screen: the one line that says where you are.
//
// Plain ink. It was drawn across the app's own spectrum for a while, on the reasoning
// that a 20px black title is the one piece of text up here large enough to carry a
// colour — true, and the wrong thing to spend it on. A screen title is read once on the
// way in and then scrolled past; a gradient on it made five screens that are one tool
// look like five products, and it put the brightest thing on the screen furthest from
// whatever the reader came to change. The colour that is left on these screens is on the
// challenge names in the sessions list, where the hue is what the row is recognised by.
function AdminTitle({ title }: { title: string }) {
  return (
    <Text selectable={false} className={cn(TYPE.screenTitle, 'mb-3 text-primary')}>
      {title}
    </Text>
  )
}

export function AdminScreen({
  title,
  heading,
  error = null,
  footer,
  children,
}: {
  // The screen's own name, already translated.
  title?: string
  // A heading a detail screen builds for itself, where what names the screen is a
  // player's nickname or an editable field rather than a word. Exactly one of this and
  // `title` is passed.
  heading?: ReactNode
  // Whatever the server last refused, reported in one place on every screen: under the
  // heading and above the content, which is where a reader looks after pressing something
  // that did not happen.
  error?: string | null
  // The way out, pinned under the content. Never scrolls with it.
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <ScreenLayer className="px-4 pb-4 pt-12">
      {title !== undefined && <AdminTitle title={title} />}
      {heading}
      {error !== null && (
        <Text selectable={false} className={cn(TYPE.value, 'mb-2 text-red-500')}>
          {error}
        </Text>
      )}
      <View className="flex-1">{children}</View>
      <View className="mt-3">{footer}</View>
    </ScreenLayer>
  )
}

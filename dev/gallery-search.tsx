import { Pressable, Text, TextInput, View } from 'react-native'

// The way into a list too long to read down.
//
// Ninety-odd entries across seventeen sections is more than a desk-height column holds,
// and most of the time the screen wanted is already known by name — three letters beats
// folding sections open looking for it. Typing anything drops the grouping entirely and
// the picker answers with a flat list, so what is matched against is both halves of the
// name: 'crown' finds it under GAME OVER, 'game over' finds all eleven.
export function GallerySearch({
  query,
  matches,
  onChange,
}: {
  query: string
  matches: number
  onChange: (next: string) => void
}) {
  const searching = query.length > 0

  return (
    <View className="flex-row items-center gap-1.5 border-b border-muted px-2 py-2">
      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="SEARCH"
        autoCapitalize="none"
        autoCorrect={false}
        className="flex-1 rounded-lg bg-card px-2.5 py-2 font-mono text-[12px] font-bold tracking-[0.5px] text-primary"
      />
      {/* The count is the one thing a flat result list cannot say for itself: with the
          sections gone there is no shape left to judge "did that narrow anything" by. */}
      {searching && (
        <Text
          selectable={false}
          className="font-mono text-[10px] font-black tracking-[1px] text-dim"
        >
          {matches}
        </Text>
      )}
      {searching && (
        <Pressable
          onPress={() => {
            onChange('')
          }}
          className="rounded-lg bg-card px-2.5 py-2"
        >
          <Text selectable={false} className="font-mono text-[13px] font-black text-dim">
            ×
          </Text>
        </Pressable>
      )}
    </View>
  )
}

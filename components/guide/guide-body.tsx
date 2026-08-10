import { Text } from 'react-native'

export function GuideBody({ children }: { children: string }) {
  return (
    <Text
      selectable={false}
      className="font-mono text-[12px] font-medium leading-[19px] text-dim"
    >
      {children}
    </Text>
  )
}

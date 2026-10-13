import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

export function List<T>({
  data,
  keyExtractor,
  renderItem,
  empty,
}: {
  data: readonly T[]
  keyExtractor: (item: T) => string
  renderItem: (item: T) => ReactNode
  empty?: ReactNode
}) {
  if (data.length === 0) return <>{empty}</>
  return (
    <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {data.map((item, index) => (
        <View key={keyExtractor(item)} className={index > 0 ? 'border-t border-neutral-200' : undefined}>
          {renderItem(item)}
        </View>
      ))}
    </View>
  )
}

export function ListRow({
  title,
  subtitle,
  onPress,
  trailing,
  accessibilityLabel,
}: {
  title: string
  subtitle?: string
  onPress?: () => void
  trailing?: ReactNode
  accessibilityLabel?: string
}) {
  const body = (
    <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1">
        <Text className="text-base font-medium text-neutral-900">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-neutral-500" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      className="active:bg-neutral-50"
    >
      {body}
    </Pressable>
  )
}

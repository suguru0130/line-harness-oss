import { ActivityIndicator, Text, View } from 'react-native'

import { Button } from './button'

export function LoadingState({ message = '読み込んでいます' }: { message?: string }) {
  return (
    <View className="items-center justify-center px-6 py-8">
      <ActivityIndicator color="#06C755" />
      <Text className="mt-3 text-sm text-neutral-600">{message}</Text>
    </View>
  )
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View className="items-center px-6 py-8">
      <Text className="text-center text-base font-semibold text-neutral-900">{title}</Text>
      {message ? <Text className="mt-2 text-center text-sm leading-5 text-neutral-600">{message}</Text> : null}
    </View>
  )
}

export function ErrorState({
  title = '読み込めませんでした',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <View className="items-center px-6 py-8">
      <Text className="text-center text-base font-semibold text-neutral-900">{title}</Text>
      {message ? <Text className="mt-2 text-center text-sm leading-5 text-neutral-600">{message}</Text> : null}
      {onRetry ? (
        <View className="mt-4">
          <Button label="再試行" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  )
}

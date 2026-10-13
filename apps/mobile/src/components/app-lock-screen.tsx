import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/button'

export function AppLockScreen({
  prompting,
  recovery,
  onUnlock,
  onRecover,
}: {
  prompting: boolean
  recovery: boolean
  onUnlock: () => void
  onRecover: () => void
}) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-line">
          <Text className="text-xl font-bold text-white">L</Text>
        </View>
        <Text className="text-2xl font-bold text-neutral-900">L-SP</Text>
        {recovery ? (
          <Text className="mt-3 text-center text-base leading-6 text-neutral-600">
            この端末では生体認証を使えません。ロックをオフにしてアプリを開きます。
          </Text>
        ) : (
          <Text className="mt-3 text-center text-base leading-6 text-neutral-600">
            続けるには、生体認証でロックを解除してください。
          </Text>
        )}
        <View className="mt-8 w-full gap-3">
          {recovery ? (
            <Button label="ロックをオフにして続ける" onPress={onRecover} />
          ) : (
            <Button label={prompting ? '確認しています' : 'ロックを解除'} disabled={prompting} onPress={onUnlock} />
          )}
        </View>
        <Text className="mt-8 text-center text-xs leading-5 text-neutral-400">
          解除できないときは、端末の生体認証が有効か確認してください。
        </Text>
      </View>
    </SafeAreaView>
  )
}

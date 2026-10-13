import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom', 'left', 'right']}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View className="gap-4 px-4 py-4">
          {title ? <Text className="text-2xl font-bold text-neutral-900">{title}</Text> : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

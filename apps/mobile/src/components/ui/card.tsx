import type { ReactNode } from 'react'
import { View } from 'react-native'

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-2xl border border-neutral-200 bg-white p-4">{children}</View>
}

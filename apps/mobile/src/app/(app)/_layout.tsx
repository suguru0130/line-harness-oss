import { Redirect, Slot } from 'expo-router'
import { View } from 'react-native'

import { LoadingState } from '@/components/ui/states'
import { useSession } from '@/providers/session-provider'

export default function AppGroupLayout() {
  const session = useSession()
  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <LoadingState message="接続を確認しています" />
      </View>
    )
  }
  if (session.status === 'signedOut') return <Redirect href="/login" />
  return <Slot />
}

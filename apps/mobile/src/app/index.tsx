import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mobileCredentialStore } from '@/lib/api'
import { describeCredentialState } from '@/lib/credential-status'

export default function HomeScreen() {
  const [status, setStatus] = useState('接続設定を確認しています')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [serverUrl, apiKey] = await Promise.all([
          mobileCredentialStore.getServerUrl(),
          mobileCredentialStore.getApiKey(),
        ])
        if (!cancelled) setStatus(describeCredentialState({ serverUrl, apiKey }))
      } catch {
        if (!cancelled) setStatus('この環境では安全な保存領域を使えません')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-line">
          <Text className="text-lg font-bold text-white">H</Text>
        </View>
        <Text className="text-2xl font-bold text-neutral-900">LINE CRM</Text>
        <Text className="mt-3 text-center text-base leading-6 text-neutral-600">
          オペレーター向けスマホアプリの土台です。ログイン、友だち、チャット、配信の画面は、このあと別の PR で足します。
        </Text>
        <Text className="mt-6 text-center text-sm text-neutral-500">{status}</Text>
      </View>
    </SafeAreaView>
  )
}

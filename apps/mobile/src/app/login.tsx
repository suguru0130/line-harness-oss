import { useState } from 'react'
import { Redirect } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SavedConnectionList } from '@/components/saved-connection-list'
import { Button, Card } from '@/components/ui'
import { LoadingState } from '@/components/ui/states'
import { TextField } from '@/components/ui/text-field'
import { useSession } from '@/providers/session-provider'
import { checkApiKey } from '@/shell/api-key'
import { probeFailureMessage } from '@/shell/probe'
import { prepareServerUrl } from '@/shell/server-url'

export default function LoginScreen() {
  const session = useSession()
  const [serverUrl, setServerUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)

  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <LoadingState message="接続を確認しています" />
      </View>
    )
  }
  if (session.status === 'signedIn') return <Redirect href="/home" />

  async function submit() {
    setUrlError(null)
    setKeyError(null)
    session.clearError()
    const key = checkApiKey(apiKey)
    const url = prepareServerUrl(serverUrl, key.ok ? key.apiKey : undefined)
    if (!url.ok) {
      setUrlError(
        url.issue === 'has-secret' ? probeFailureMessage('url-has-secret') : probeFailureMessage('invalid-url'),
      )
      return
    }
    if (!key.ok) {
      setKeyError(key.issue === 'too-long' ? probeFailureMessage('key-too-long') : probeFailureMessage('key-empty'))
      return
    }
    const ok = await session.signIn({ serverUrl: url.serverUrl, apiKey: key.apiKey, label })
    if (ok) {
      setApiKey('')
      setServerUrl('')
      setLabel('')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <ScrollView keyboardShouldPersistTaps="handled">
        <View className="gap-4 px-5 py-8">
          <View className="items-center">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-line">
              <Text className="text-lg font-bold text-white">L</Text>
            </View>
            <Text className="text-2xl font-bold text-neutral-900">L-SP</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-neutral-600">
              サーバー URL と API キーで接続します。鍵はこの端末の安全な保存領域にだけ残します。
            </Text>
          </View>

          <Card>
            <View className="gap-4">
              <TextField
                label="サーバー URL"
                value={serverUrl}
                onChangeText={setServerUrl}
                kind="url"
                placeholder="https://example.workers.dev"
                error={urlError}
                testID="login-server-url"
              />
              <TextField
                label="APIキー"
                value={apiKey}
                onChangeText={setApiKey}
                kind="password"
                placeholder="APIキーを入力"
                error={keyError}
                testID="login-api-key"
              />
              <TextField
                label="接続の名前（空でもよい）"
                value={label}
                onChangeText={setLabel}
                placeholder="店舗用"
                testID="login-label"
              />
              {session.error ? (
                <Text className="text-sm text-red-600" accessibilityLiveRegion="polite">
                  {session.error}
                </Text>
              ) : null}
              <Button
                label={session.busy ? '接続しています' : 'ログイン'}
                disabled={session.busy}
                onPress={() => void submit()}
                testID="login-submit"
              />
            </View>
          </Card>

          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-500">保存した接続</Text>
            <SavedConnectionList
              items={session.connections}
              activeId={null}
              busy={session.busy}
              onSelect={(id) => {
                session.clearError()
                void session.signInSaved(id)
              }}
              onDelete={(id) => void session.removeConnection(id)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

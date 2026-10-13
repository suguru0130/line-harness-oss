import Constants from 'expo-constants'
import { useState } from 'react'
import { Switch, Text, View } from 'react-native'

import { SavedConnectionList } from '@/components/saved-connection-list'
import { Button, Card, ConfirmDialog, Screen } from '@/components/ui'
import { describeCredentialState } from '@/lib/credential-status'
import { useAppLock } from '@/providers/app-lock-provider'
import { useSession } from '@/providers/session-provider'
import { displayServerUrl } from '@/shell/server-url'
import { roleLabel } from '@/shell/roles'

export default function SettingsScreen() {
  const session = useSession()
  const lock = useAppLock()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const version = Constants.expoConfig?.version ?? '0.1.0'
  const signedIn = session.status === 'signedIn'
  const serverUrl = signedIn ? displayServerUrl(session.serverUrl) : ''

  return (
    <Screen>
      <Card>
        <Text className="text-sm font-medium text-neutral-500">接続中</Text>
        <Text className="mt-1 text-lg font-semibold text-neutral-900">
          {signedIn ? (session.connectionLabel ?? '名前未設定') : '未接続'}
        </Text>
        <Text className="mt-1 text-sm text-neutral-600">{serverUrl || 'URLを表示できません'}</Text>
        <Text className="mt-2 text-sm text-neutral-600">
          {signedIn ? (session.staffName ?? '名前未設定') : '未接続'} · {roleLabel(signedIn ? session.role : null)}
        </Text>
        <Text className="mt-2 text-xs leading-5 text-neutral-500">
          {describeCredentialState({
            serverUrl: signedIn ? session.serverUrl : null,
            // 有無だけを渡す。本物の API キーはここでは渡さない。
            apiKey: signedIn ? 'stored' : null,
          })}
        </Text>
      </Card>

      <View className="gap-2">
        <Text className="text-sm font-medium text-neutral-500">保存した接続</Text>
        <SavedConnectionList
          items={session.connections}
          activeId={session.connectionId}
          busy={session.busy}
          onSelect={(id) => void session.signInSaved(id)}
          onDelete={(id) => void session.removeConnection(id)}
        />
      </View>

      <Card>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-neutral-900">生体認証ロック</Text>
            <Text className="mt-1 text-sm leading-5 text-neutral-600">
              オンにすると、アプリを離れたあと、次に開くときに生体認証を求めます。
            </Text>
          </View>
          <Switch
            accessibilityLabel="生体認証ロック"
            value={lock.enabled}
            disabled={!lock.available || session.busy}
            onValueChange={(next) => {
              if (next) void lock.enable()
              else void lock.disable()
            }}
            trackColor={{ false: '#d4d4d4', true: '#06C755' }}
            testID="settings-biometric"
          />
        </View>
        {!lock.available ? (
          <Text className="mt-2 text-sm text-neutral-500">この端末では生体認証を使えません。</Text>
        ) : null}
        {lock.notice ? <Text className="mt-2 text-sm text-neutral-600">{lock.notice}</Text> : null}
      </Card>

      <Card>
        <Text className="text-sm font-medium text-neutral-500">バージョン</Text>
        <Text className="mt-1 text-base text-neutral-900">{version}</Text>
      </Card>

      <Button
        label="ログアウト"
        variant="danger"
        disabled={session.busy || !signedIn}
        onPress={() => setLogoutOpen(true)}
      />
      {session.error ? (
        <Text className="text-sm text-red-600" accessibilityLiveRegion="polite">
          {session.error}
        </Text>
      ) : null}

      <ConfirmDialog
        visible={logoutOpen}
        title="ログアウトしますか"
        message="この端末のログイン状態を終了します。保存した接続先は残るので、あとから選び直せます。"
        confirmLabel="ログアウト"
        tone="danger"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false)
          void session.signOut()
        }}
      />
    </Screen>
  )
}

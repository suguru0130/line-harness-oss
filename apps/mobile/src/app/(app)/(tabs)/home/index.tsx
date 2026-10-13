import { Text } from 'react-native'

import { Card, Screen } from '@/components/ui'
import { useLineAccount } from '@/providers/account-provider'
import { useSession } from '@/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { displayServerUrl } from '@/shell/server-url'
import { roleLabel } from '@/shell/roles'

/** プレースホルダ。ホームの中身はこのフォルダだけを置き換える。手順は apps/mobile/CONTRIBUTING-screens.md */
export default function HomeScreen() {
  const session = useSession()
  const account = useLineAccount()
  const role = session.status === 'signedIn' ? session.role : null
  const serverUrl = session.status === 'signedIn' ? displayServerUrl(session.serverUrl) : ''

  return (
    <Screen title="ホーム">
      <Card>
        <Text className="text-base leading-6 text-neutral-600">
          ホームはこれから作ります。友だちの数や未返信は、別の PR でこのフォルダに足します。
        </Text>
      </Card>
      <Card>
        <Text className="text-sm font-medium text-neutral-500">ログイン中</Text>
        <Text className="mt-1 text-base font-semibold text-neutral-900">
          {session.status === 'signedIn' ? (session.staffName ?? '名前未設定') : '未接続'}
        </Text>
        <Text className="mt-1 text-sm text-neutral-600">{roleLabel(role)}</Text>
        {serverUrl ? <Text className="mt-1 text-sm text-neutral-500">{serverUrl}</Text> : null}
      </Card>
      <Card>
        <Text className="text-sm font-medium text-neutral-500">選択中のLINEアカウント</Text>
        {account.status === 'loading' ? <LoadingState message="読み込んでいます" /> : null}
        {account.status === 'error' ? (
          <ErrorState
            title="読み込めませんでした"
            message={account.error ?? undefined}
            onRetry={() => void account.reload()}
          />
        ) : null}
        {account.status === 'ready' && account.selected ? (
          <Text className="mt-1 text-base font-semibold text-neutral-900">{account.selected.displayName}</Text>
        ) : null}
        {account.status === 'ready' && !account.selected ? <EmptyState title="LINEアカウントはまだありません" /> : null}
      </Card>
    </Screen>
  )
}

import { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useLineAccount } from '@/providers/account-provider'
import { useSession } from '@/providers/session-provider'
import type { LineAccountSummary } from '@/shell/profiles'
import { roleLabel } from '@/shell/roles'

function AccountAvatar({ account }: { account: LineAccountSummary }) {
  const letter = account.displayName.trim().charAt(0) || 'L'
  if (account.pictureUrl) {
    return (
      <Image
        source={{ uri: account.pictureUrl }}
        accessibilityIgnoresInvertColors
        style={{ width: 36, height: 36, borderRadius: 18 }}
      />
    )
  }
  return (
    <View className="h-9 w-9 items-center justify-center rounded-full bg-line">
      <Text className="text-sm font-bold text-white">{letter}</Text>
    </View>
  )
}

function accountSubtitle(account: LineAccountSummary): string {
  const parts: string[] = []
  if (account.basicId) parts.push(account.basicId)
  if (account.country) parts.push(account.country)
  if (account.accountRole) parts.push(account.accountRole)
  if (!account.isActive) parts.push('停止中')
  return parts.join(' · ')
}

export function AccountSwitcherHeader() {
  const session = useSession()
  const { status, accounts, selected, error, select, reload } = useLineAccount()
  const [open, setOpen] = useState(false)
  const role = session.status === 'signedIn' ? session.role : null

  async function choose(id: string) {
    await select(id)
    setOpen(false)
  }

  return (
    <View className="border-b border-neutral-200 bg-white px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="LINEアカウントを切り替える"
          onPress={() => setOpen(true)}
          className="min-h-[44px] flex-1 flex-row items-center gap-3"
        >
          {selected ? <AccountAvatar account={selected} /> : (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-line">
              <Text className="text-sm font-bold text-white">L</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
              {selected ? selected.displayName : 'L-SP'}
            </Text>
            <Text className="text-xs text-neutral-500" numberOfLines={1}>
              {status === 'loading' ? 'LINEアカウントを読み込んでいます' : null}
              {status === 'error' ? 'アカウントを読み込めませんでした' : null}
              {status === 'ready' && selected ? accountSubtitle(selected) || 'LINEアカウント' : null}
              {status === 'ready' && !selected ? 'LINEアカウントはまだありません' : null}
              {status === 'idle' ? 'LINEアカウント' : null}
            </Text>
          </View>
        </Pressable>
        <View className="rounded-full bg-neutral-100 px-2 py-1">
          <Text className="text-xs font-medium text-neutral-700">{roleLabel(role)}</Text>
        </View>
      </View>
      {status === 'error' ? (
        <Pressable accessibilityRole="button" onPress={() => void reload()} className="mt-2 self-start">
          <Text className="text-sm font-medium text-line">再試行</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-neutral-50">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-lg font-bold text-neutral-900">LINEアカウント</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={() => setOpen(false)}>
              <Text className="text-base font-medium text-line">閉じる</Text>
            </Pressable>
          </View>
          <ScrollView>
            <View className="px-4 pb-6">
              {status === 'loading' ? <LoadingState message="読み込んでいます" /> : null}
              {status === 'error' ? (
                <ErrorState title="読み込めませんでした" message={error ?? undefined} onRetry={() => void reload()} />
              ) : null}
              {status === 'ready' && accounts.length === 0 ? (
                <EmptyState title="LINEアカウントはまだありません" />
              ) : null}
              {status === 'ready'
                ? accounts.map((account) => {
                    const current = account.id === selected?.id
                    return (
                      <Pressable
                        key={account.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: current }}
                        onPress={() => void choose(account.id)}
                        className={current ? 'mb-2 flex-row items-center gap-3 rounded-2xl bg-green-50 px-3 py-3' : 'mb-2 flex-row items-center gap-3 rounded-2xl bg-white px-3 py-3'}
                      >
                        <AccountAvatar account={account} />
                        <View className="flex-1">
                          <Text className="text-base font-medium text-neutral-900">{account.displayName}</Text>
                          {accountSubtitle(account) ? (
                            <Text className="text-sm text-neutral-500">{accountSubtitle(account)}</Text>
                          ) : null}
                        </View>
                        {current ? <Text className="text-xs font-medium text-line">選択中</Text> : null}
                      </Pressable>
                    )
                  })
                : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

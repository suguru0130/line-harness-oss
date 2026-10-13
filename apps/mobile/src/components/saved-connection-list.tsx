import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/states'
import { List } from '@/components/ui/list'
import type { ConnectionSummary } from '@/shell/connections'
import { displayServerUrl } from '@/shell/server-url'

export function SavedConnectionList({
  items,
  activeId,
  busy,
  onSelect,
  onDelete,
}: {
  items: readonly ConnectionSummary[]
  activeId: string | null
  busy: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [pending, setPending] = useState<ConnectionSummary | null>(null)
  const pendingUrl = pending ? displayServerUrl(pending.serverUrl) : ''

  return (
    <>
      <List
        data={items}
        keyExtractor={(item) => item.id}
        empty={<EmptyState title="保存した接続はまだありません" message="上のフォームから追加できます。" />}
        renderItem={(item) => {
          const url = displayServerUrl(item.serverUrl)
          const active = item.id === activeId
          return (
            <View className="min-h-[52px] flex-row items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.label}で接続`}
                disabled={busy}
                onPress={() => onSelect(item.id)}
                className="flex-1 px-4 py-3"
              >
                <Text className="text-base font-medium text-neutral-900">{item.label}</Text>
                <Text className="mt-0.5 text-sm text-neutral-500" numberOfLines={1}>
                  {url || 'URLを表示できません'}
                </Text>
                {active ? <Text className="mt-1 text-xs font-medium text-line">接続中</Text> : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.label}を削除`}
                disabled={busy}
                onPress={() => setPending(item)}
                className="px-4 py-3"
              >
                <Text className="text-sm font-medium text-red-600">削除</Text>
              </Pressable>
            </View>
          )
        }}
      />
      <ConfirmDialog
        visible={pending !== null}
        title="この接続を削除しますか"
        message={
          pending
            ? `${pending.label}（${pendingUrl || 'URLを表示できません'}）をこの端末から消します。`
            : ''
        }
        confirmLabel="削除する"
        tone="danger"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onDelete(pending.id)
          setPending(null)
        }}
      />
    </>
  )
}

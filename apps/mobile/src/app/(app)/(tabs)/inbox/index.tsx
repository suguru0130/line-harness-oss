import { Text } from 'react-native'

import { Card, Screen } from '@/components/ui'

/** プレースホルダ。受信箱はこのフォルダに足す。手順は apps/mobile/CONTRIBUTING-screens.md */
export default function InboxScreen() {
  return (
    <Screen title="受信箱">
      <Card>
        <Text className="text-base leading-6 text-neutral-600">
          受信箱はこれから作ります。返信、テンプレート、状態と担当の変更は、別の PR でこのフォルダに足します。
        </Text>
      </Card>
    </Screen>
  )
}

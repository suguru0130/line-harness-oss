import { Text } from 'react-native'

import { Card, Screen } from '@/components/ui'

/** プレースホルダ。友だちはこのフォルダに足す。手順は apps/mobile/CONTRIBUTING-screens.md */
export default function FriendsScreen() {
  return (
    <Screen title="友だち">
      <Card>
        <Text className="text-base leading-6 text-neutral-600">
          友だちはこれから作ります。検索、タグ、メモは、別の PR でこのフォルダに足します。
        </Text>
      </Card>
    </Screen>
  )
}

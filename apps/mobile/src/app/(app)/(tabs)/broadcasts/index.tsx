import { Text } from 'react-native'

import { RoleGate } from '@/components/role-gate'
import { Card, Screen } from '@/components/ui'
import { useSession } from '@/providers/session-provider'

/** プレースホルダ。配信はこのフォルダに足す。手順は apps/mobile/CONTRIBUTING-screens.md */
export default function BroadcastsScreen() {
  const session = useSession()
  const role = session.status === 'signedIn' ? session.role : null

  return (
    <Screen title="配信">
      <Card>
        <RoleGate
          role={role}
          minimum="admin"
          fallback={
            <Text className="text-base leading-6 text-neutral-600">
              配信の作成と ON/OFF は管理者以上の操作です。画面はこれから作ります。
            </Text>
          }
        >
          <Text className="text-base leading-6 text-neutral-600">
            この権限では配信の作成と ON/OFF が使えます。画面はこれから作ります。送る前の2段階確認は ConfirmDialog を使います。
          </Text>
        </RoleGate>
      </Card>
    </Screen>
  )
}

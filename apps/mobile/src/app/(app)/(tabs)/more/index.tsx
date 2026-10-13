import { Link, type Href } from 'expo-router'
import { Pressable } from 'react-native'

import { List, ListRow, Screen } from '@/components/ui'
import { moreLinks } from '@/navigation/more'
import { useSession } from '@/providers/session-provider'
import { visibleMoreLinks } from '@/shell/more-links'

/** その他の入口。新しい画面は more/ に足し、navigation/more に 1 行足す。 */
export default function MoreScreen() {
  const session = useSession()
  const role = session.status === 'signedIn' ? session.role : null
  const links = visibleMoreLinks(moreLinks, role)

  return (
    <Screen title="その他">
      <List
        data={links}
        keyExtractor={(item) => item.id}
        renderItem={(item) => {
          // href は入口ファイルの文字列。生成されたルート型へはここで合わせる。
          return (
            <Link href={item.href as Href} asChild>
              <Pressable accessibilityRole="link">
                <ListRow title={item.title} subtitle={item.description} />
              </Pressable>
            </Link>
          )
        }}
      />
    </Screen>
  )
}

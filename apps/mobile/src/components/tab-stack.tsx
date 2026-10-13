import { Stack } from 'expo-router'

/** タブの中の詳細画面は、この Stack の隣にファイルを足す。タブは増えない。 */
export function TabStack() {
  return <Stack screenOptions={{ headerShown: false }} />
}

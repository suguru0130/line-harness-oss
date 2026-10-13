import { Stack } from 'expo-router'

export default function MoreStack() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: '#111827',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fafafa' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: '設定' }} />
    </Stack>
  )
}

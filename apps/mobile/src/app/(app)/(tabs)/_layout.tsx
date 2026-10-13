import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AccountSwitcherHeader } from '@/components/account-switcher'
import { AccountProvider } from '@/providers/account-provider'

export default function TabLayout() {
  return (
    <AccountProvider>
      <View className="flex-1 bg-neutral-50">
        <SafeAreaView edges={['top']} className="bg-white">
          <AccountSwitcherHeader />
        </SafeAreaView>
        <Tabs
          initialRouteName="home"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#06C755',
            tabBarInactiveTintColor: '#737373',
            tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e5e5' },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          }}
        >
          <Tabs.Screen name="home" options={{ title: 'ホーム' }} />
          <Tabs.Screen name="inbox" options={{ title: '受信箱' }} />
          <Tabs.Screen name="friends" options={{ title: '友だち' }} />
          <Tabs.Screen name="broadcasts" options={{ title: '配信' }} />
          <Tabs.Screen name="more" options={{ title: 'その他' }} />
        </Tabs>
      </View>
    </AccountProvider>
  )
}

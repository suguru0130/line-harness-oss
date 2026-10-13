import type { ConfigContext, ExpoConfig } from 'expo/config'

const EAS_PROJECT_ID = '813ad40d-1c28-4532-9d5e-bb04b670fe87'

/**
 * `owner` は Expo のアカウント名（個人または Organization の slug）。
 * プロジェクトは非公開なので、ここには書かない。
 * EXPO_TOKEN のアカウントがオーナーなら省略でよい。
 * Organization で `eas update` がアカウント不一致と言ったら、
 * 環境変数 EXPO_OWNER に slug を入れる。
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LINE CRM',
  slug: 'line-crm',
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'linecrm',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.linecrm.operator',
    icon: './assets/expo.icon',
  },
  android: {
    package: 'app.linecrm.operator',
    adaptiveIcon: {
      backgroundColor: '#06C755',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#06C755',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
    router: {},
  },
})

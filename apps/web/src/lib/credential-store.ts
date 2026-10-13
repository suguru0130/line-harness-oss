import { createLocalStorageCredentialStore } from '@line-crm/admin-client'

/**
 * Web の保存先。API キーの名前はログイン画面がもともと書いていた `lh_api_key`。
 * サーバー URL は、端末に上書きがなければビルド時の NEXT_PUBLIC_API_URL。
 */
export const webCredentialStore = createLocalStorageCredentialStore({
  fallbackServerUrl: process.env.NEXT_PUBLIC_API_URL ?? null,
})

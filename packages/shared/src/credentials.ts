/**
 * オペレーターアプリが Worker の URL と API キーを読む・書く窓口。
 * Web は localStorage、モバイルは expo-secure-store。
 * API キーをログや画面に出さないこと。
 */

/** 管理画面のログインがもともと使っているキー名。変えると既存セッションが切れる。 */
export const API_KEY_STORAGE_KEY = 'lh_api_key'

/** サーバー URL の上書き。Web は未設定なら NEXT_PUBLIC_API_URL に戻る。 */
export const SERVER_URL_STORAGE_KEY = 'lh_server_url'

/**
 * 保存されたサーバー URL を、API キーを付ける前に http(s) だけに揃える。
 * 末尾のスラッシュは除く。`file:` や `javascript:` はここではじく。
 */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Server URL must start with http:// or https://')
  }
  return trimmed
}

export interface ApiCredentialStore {
  getServerUrl(): Promise<string | null>
  setServerUrl(url: string): Promise<void>
  getApiKey(): Promise<string | null>
  setApiKey(apiKey: string): Promise<void>
  clear(): Promise<void>
  /**
   * `<img src>` のように、その場で文字列が要る呼び出し用。
   * Web の localStorage は同期で読める。SecureStore は非同期だけなので実装しない。
   */
  getServerUrlSync?: () => string | null
  getApiKeySync?: () => string | null
}

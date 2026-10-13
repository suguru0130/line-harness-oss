/** いま開いている接続の ID。API キーは入れない。 */
export const ACTIVE_CONNECTION_ID_KEY = 'lh_active_connection'

/** 保存した接続の一覧。API キーは入れない。鍵本体は接続ごとの別項目。 */
export const SAVED_CONNECTIONS_KEY = 'lh_saved_connections'

export const STAFF_PROFILE_KEY = 'lh_staff_profile'

/** 選択中の LINE アカウント ID。トークンは入れない。 */
export const SELECTED_LINE_ACCOUNT_KEY = 'lh_selected_account'

export const BIOMETRIC_LOCK_KEY = 'lh_biometric_lock'

const CONNECTION_ID = /^[0-9a-f]{16}$/

export function isConnectionId(id: string): boolean {
  return CONNECTION_ID.test(id)
}

/** SecureStore の項目名。ID が形式どおりのときだけ作る。 */
export function connectionSecretKey(id: string): string {
  if (!isConnectionId(id)) {
    throw new Error('Invalid connection id')
  }
  return `lh_conn_${id}`
}

export function createConnectionId(): string {
  const cryptoObj = globalThis.crypto
  if (!cryptoObj?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available')
  }
  const bytes = new Uint8Array(8)
  cryptoObj.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

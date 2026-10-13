import {
  API_KEY_STORAGE_KEY,
  SERVER_URL_STORAGE_KEY,
  normalizeServerUrl,
  type ApiCredentialStore,
} from '@line-crm/shared'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}

function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null
    const storage = globalThis.localStorage
    if (typeof storage.getItem !== 'function') return null
    return storage
  } catch {
    return null
  }
}

function readHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return normalizeServerUrl(url)
  } catch {
    return null
  }
}

/**
 * Web 管理画面用。API キーは `lh_api_key`（既存ログインと同じ）。
 * サーバー URL は localStorage の上書きがあればそれ、なければビルド時の URL。
 * http(s) 以外の上書きは無視する。無効な値で管理画面を止めない。
 */
export function createLocalStorageCredentialStore(options?: {
  fallbackServerUrl?: string | null
  storage?: KeyValueStorage | null
}): ApiCredentialStore {
  const fallbackServerUrl = options?.fallbackServerUrl ?? null
  const storage = (): KeyValueStorage | null => {
    if (options && 'storage' in options) return options.storage ?? null
    return browserStorage()
  }

  const readItem = (key: string): string | null => {
    try {
      return storage()?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const readServerUrl = (): string | null => {
    const stored = readHttpUrl(readItem(SERVER_URL_STORAGE_KEY))
    if (stored) return stored
    if (!fallbackServerUrl) return null
    return normalizeServerUrl(fallbackServerUrl)
  }
  const readApiKey = (): string | null => readItem(API_KEY_STORAGE_KEY)

  return {
    async getServerUrl() {
      return readServerUrl()
    },
    getServerUrlSync: readServerUrl,
    getApiKeySync() {
      return readApiKey() ?? ''
    },
    async setServerUrl(url: string) {
      const normalized = normalizeServerUrl(url)
      storage()?.setItem(SERVER_URL_STORAGE_KEY, normalized)
    },
    async getApiKey() {
      return readApiKey()
    },
    async setApiKey(apiKey: string) {
      const current = storage()
      if (!current) return
      if (apiKey) current.setItem(API_KEY_STORAGE_KEY, apiKey)
      else current.removeItem(API_KEY_STORAGE_KEY)
    },
    async clear() {
      const current = storage()
      current?.removeItem(API_KEY_STORAGE_KEY)
      current?.removeItem(SERVER_URL_STORAGE_KEY)
    },
  }
}

/** モバイル用。expo-secure-store を外から渡すので、このパッケージは Expo に依存しない。 */
export function createSecureStoreCredentialStore(secureStore: SecureStoreLike): ApiCredentialStore {
  return {
    async getServerUrl() {
      return readHttpUrl(await secureStore.getItemAsync(SERVER_URL_STORAGE_KEY))
    },
    async setServerUrl(url: string) {
      await secureStore.setItemAsync(SERVER_URL_STORAGE_KEY, normalizeServerUrl(url))
    },
    async getApiKey() {
      return secureStore.getItemAsync(API_KEY_STORAGE_KEY)
    },
    async setApiKey(apiKey: string) {
      if (apiKey) await secureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey)
      else await secureStore.deleteItemAsync(API_KEY_STORAGE_KEY)
    },
    async clear() {
      await secureStore.deleteItemAsync(API_KEY_STORAGE_KEY)
      await secureStore.deleteItemAsync(SERVER_URL_STORAGE_KEY)
    },
  }
}

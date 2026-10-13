import type { SecureStoreLike } from '@line-crm/admin-client'

interface StringStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** ブラウザで Expo を開いたときだけ使う。キー名は SecureStore と同じ。 */
export function createBrowserSecureStore(storage: StringStorage): SecureStoreLike {
  return {
    async getItemAsync(key) {
      try {
        return storage.getItem(key)
      } catch {
        return null
      }
    },
    async setItemAsync(key, value) {
      storage.setItem(key, value)
    },
    async deleteItemAsync(key) {
      storage.removeItem(key)
    },
  }
}

export function browserSecureStorage(): SecureStoreLike | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  try {
    const storage = window.localStorage
    if (!storage || typeof storage.getItem !== 'function') return null
    return createBrowserSecureStore(storage)
  } catch {
    return null
  }
}

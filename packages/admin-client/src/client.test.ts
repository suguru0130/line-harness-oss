import { describe, expect, it, vi, beforeEach } from 'vitest'
import { API_KEY_STORAGE_KEY, SERVER_URL_STORAGE_KEY } from '@line-crm/shared'
import { fetchApi, setAdminCredentialStore } from './client'
import {
  createLocalStorageCredentialStore,
  createSecureStoreCredentialStore,
  type KeyValueStorage,
  type SecureStoreLike,
} from './storage'

function memoryStorage(initial?: Record<string, string>): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial ?? {}))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}

function memorySecure(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => { data.set(key, value) },
    deleteItemAsync: async (key) => { data.delete(key) },
  }
}

describe('credential stores', () => {
  it('keeps the web API key in the existing localStorage slot', async () => {
    const storage = memoryStorage()
    const store = createLocalStorageCredentialStore({
      fallbackServerUrl: 'https://worker.example.com',
      storage,
    })
    expect(await store.getServerUrl()).toBe('https://worker.example.com')
    await store.setApiKey('op-key')
    expect(storage.data.get(API_KEY_STORAGE_KEY)).toBe('op-key')
    expect(await store.getApiKey()).toBe('op-key')
    await store.setServerUrl('https://override.example.com/')
    expect(await store.getServerUrl()).toBe('https://override.example.com')
    expect(storage.data.get(SERVER_URL_STORAGE_KEY)).toBe('https://override.example.com')
    await store.clear()
    expect(storage.data.has(API_KEY_STORAGE_KEY)).toBe(false)
    expect(storage.data.has(SERVER_URL_STORAGE_KEY)).toBe(false)
    expect(await store.getServerUrl()).toBe('https://worker.example.com')
  })

  it('ignores a non-http server URL and refuses to store one', async () => {
    const storage = memoryStorage({ [SERVER_URL_STORAGE_KEY]: 'file:///tmp/secret' })
    const store = createLocalStorageCredentialStore({
      fallbackServerUrl: 'https://worker.example.com/',
      storage,
    })
    expect(await store.getServerUrl()).toBe('https://worker.example.com')
    await expect(store.setServerUrl('javascript:alert(1)')).rejects.toThrow(/http/)
    expect(storage.data.get(SERVER_URL_STORAGE_KEY)).toBe('file:///tmp/secret')
  })

  it('round-trips the mobile secure store without putting the key in the bundle', async () => {
    const secure = memorySecure()
    const store = createSecureStoreCredentialStore(secure)
    await store.setServerUrl('https://worker.example.com')
    await store.setApiKey('phone-key')
    expect(await store.getServerUrl()).toBe('https://worker.example.com')
    expect(await store.getApiKey()).toBe('phone-key')
    expect(secure.data.get(API_KEY_STORAGE_KEY)).toBe('phone-key')
    await store.clear()
    expect(await store.getApiKey()).toBeNull()
    expect(await store.getServerUrl()).toBeNull()
  })

  it('drops a non-http URL already in the secure store', async () => {
    const secure = memorySecure()
    secure.data.set(SERVER_URL_STORAGE_KEY, 'file:///tmp/secret')
    const store = createSecureStoreCredentialStore(secure)
    expect(await store.getServerUrl()).toBeNull()
    await expect(store.setServerUrl('file:///tmp/secret')).rejects.toThrow(/http/)
    expect(secure.data.get(SERVER_URL_STORAGE_KEY)).toBe('file:///tmp/secret')
  })
})

describe('fetchApi', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the stored URL and bearer token', async () => {
    const storage = memoryStorage()
    const store = createLocalStorageCredentialStore({
      fallbackServerUrl: 'https://worker.example.com/',
      storage,
    })
    await store.setApiKey('op-key')
    setAdminCredentialStore(store)
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { count: 3 } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchApi<{ success: boolean; data: { count: number } }>('/api/friends/count')

    expect(result.data.count).toBe(3)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://worker.example.com/api/friends/count',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer op-key',
        }),
      }),
    )
  })

  it('returns undefined for 204 and throws on HTTP errors without the key', async () => {
    setAdminCredentialStore(createLocalStorageCredentialStore({
      fallbackServerUrl: 'https://worker.example.com',
      storage: memoryStorage({ [API_KEY_STORAGE_KEY]: 'op-key' }),
    }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204, json: async () => ({}) })))
    await expect(fetchApi('/api/tags/1')).resolves.toBeUndefined()

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    await expect(fetchApi('/api/tags')).rejects.toThrow('API error: 401')
  })

  it('rejects a non-http server URL before the key is sent', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setAdminCredentialStore({
      getServerUrl: async () => 'file:///tmp/secret',
      setServerUrl: async () => {},
      getApiKey: async () => {
        throw new Error('API key was read before the server URL was checked')
      },
      setApiKey: async () => {},
      clear: async () => {},
    })
    await expect(fetchApi('/api/friends')).rejects.toThrow(/http/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

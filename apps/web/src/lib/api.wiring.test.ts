import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_KEY_STORAGE_KEY } from '@line-crm/shared'

function installMemoryStorage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  })
  return data
}

describe('web API credential wiring', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('keeps using lh_api_key and the baked server URL', async () => {
    const data = installMemoryStorage()
    const { webCredentialStore } = await import('./credential-store')
    await webCredentialStore.setApiKey('abc')
    expect(data.get(API_KEY_STORAGE_KEY)).toBe('abc')
    expect(await webCredentialStore.getServerUrl()).toBe('https://example.test')
    await webCredentialStore.clear()
    expect(data.has(API_KEY_STORAGE_KEY)).toBe(false)
    expect(await webCredentialStore.getServerUrl()).toBe('https://example.test')
  })

  it('sends the stored API key through the shared client', async () => {
    installMemoryStorage()
    const { webCredentialStore } = await import('./credential-store')
    const { fetchApi } = await import('./api')
    await webCredentialStore.setApiKey('abc')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchApi('/api/friends/count')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/friends/count',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
      }),
    )
  })
})

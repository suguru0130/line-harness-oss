import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = new Map<string, string>()

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => memory.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    memory.set(key, value)
  },
  deleteItemAsync: async (key: string) => {
    memory.delete(key)
  },
}))

describe('mobile credential store', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('stores the server URL and API key through expo-secure-store', async () => {
    const { mobileCredentialStore } = await import('./api')
    await mobileCredentialStore.setServerUrl('https://worker.example.com')
    await mobileCredentialStore.setApiKey('phone-key')
    expect(await mobileCredentialStore.getServerUrl()).toBe('https://worker.example.com')
    expect(await mobileCredentialStore.getApiKey()).toBe('phone-key')
    expect(memory.get('lh_api_key')).toBe('phone-key')
    await mobileCredentialStore.clear()
    expect(await mobileCredentialStore.getApiKey()).toBeNull()
  })
})

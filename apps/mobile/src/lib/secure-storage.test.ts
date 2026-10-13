import { describe, expect, it } from 'vitest'

import { createBrowserSecureStore } from './browser-secure-store'

describe('createBrowserSecureStore', () => {
  it('round-trips a value without logging it', async () => {
    const memory = new Map<string, string>()
    const store = createBrowserSecureStore({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: (key) => {
        memory.delete(key)
      },
    })
    await store.setItemAsync('lh_api_key', 'phone-key')
    expect(await store.getItemAsync('lh_api_key')).toBe('phone-key')
    await store.deleteItemAsync('lh_api_key')
    expect(await store.getItemAsync('lh_api_key')).toBeNull()
  })
})

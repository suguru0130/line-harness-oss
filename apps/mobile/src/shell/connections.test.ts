import { describe, expect, it } from 'vitest'

import { createConnectionDirectory } from './connections'
import { memorySecureStore } from './memory-secure-store'
import { SAVED_CONNECTIONS_KEY } from './storage-keys'

const secret = 'phone-key'

describe('connection directory', () => {
  it('stores the key outside the index that the screen lists', async () => {
    const store = memorySecureStore()
    const directory = createConnectionDirectory(store)
    const saved = await directory.upsert({
      serverUrl: 'https://worker.example.com/',
      apiKey: secret,
      label: '店舗',
    })
    const listed = await directory.list()
    expect(listed).toEqual([
      { id: saved.id, label: '店舗', serverUrl: 'https://worker.example.com' },
    ])
    expect(JSON.stringify(listed)).not.toContain(secret)
    expect(store.dump()[SAVED_CONNECTIONS_KEY]).not.toContain(secret)
    expect(await directory.readApiKey(saved.id)).toBe(secret)
  })

  it('does not keep a key that was written into the index by mistake', async () => {
    const store = memorySecureStore()
    await store.setItemAsync(
      SAVED_CONNECTIONS_KEY,
      JSON.stringify([
        {
          id: 'abcdef0123456789',
          label: '店舗',
          serverUrl: 'https://worker.example.com',
          apiKey: secret,
        },
      ]),
    )
    const directory = createConnectionDirectory(store)
    const listed = await directory.list()
    expect(JSON.stringify(listed)).not.toContain(secret)
    expect(store.dump()[SAVED_CONNECTIONS_KEY]).not.toContain(secret)
    expect(await directory.readApiKey('abcdef0123456789')).toBeNull()
  })

  it('replaces a label that is the key itself', async () => {
    const store = memorySecureStore()
    const directory = createConnectionDirectory(store)
    const saved = await directory.upsert({
      serverUrl: 'https://worker.example.com',
      apiKey: secret,
      label: secret,
    })
    expect(saved.label).toBe('worker.example.com')
    expect(JSON.stringify(await directory.list())).not.toContain(secret)
  })

  it('updates the same label instead of duplicating it', async () => {
    const store = memorySecureStore()
    const directory = createConnectionDirectory(store)
    const first = await directory.upsert({
      serverUrl: 'https://worker.example.com',
      apiKey: 'old-key',
      label: '店舗',
    })
    const second = await directory.upsert({
      serverUrl: 'https://worker.example.com',
      apiKey: secret,
      label: '店舗',
    })
    expect(second.id).toBe(first.id)
    expect(await directory.list()).toHaveLength(1)
    expect(await directory.readApiKey(first.id)).toBe(secret)
  })

  it('stops at 20 saved connections', async () => {
    const store = memorySecureStore()
    const directory = createConnectionDirectory(store)
    for (let index = 0; index < 20; index += 1) {
      await directory.upsert({
        serverUrl: `https://worker-${index}.example.com`,
        apiKey: secret,
        label: `接続${index}`,
      })
    }
    await expect(
      directory.upsert({
        serverUrl: 'https://extra.example.com',
        apiKey: secret,
        label: '追加',
      }),
    ).rejects.toMatchObject({ issue: 'too-many' })
  })
})

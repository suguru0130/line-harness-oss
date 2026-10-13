import type { ApiCredentialStore } from '@line-crm/shared'
import { describe, expect, it } from 'vitest'

import { createConnectionDirectory } from './connections'
import { memorySecureStore } from './memory-secure-store'
import { createAppPreferences } from './preferences'
import { clearActiveSession, loadOrMigrateSession, persistSignedInSession } from './session-store'

const secret = 'phone-key'

function memoryCredentials(): ApiCredentialStore & { snapshot(): { url: string | null; key: string | null } } {
  let url: string | null = null
  let key: string | null = null
  return {
    async getServerUrl() {
      return url
    },
    async setServerUrl(value) {
      url = value
    },
    async getApiKey() {
      return key
    },
    async setApiKey(value) {
      key = value ? value : null
    },
    async clear() {
      url = null
      key = null
    },
    snapshot() {
      return { url, key }
    },
  }
}

describe('session store', () => {
  it('persists a session without putting the key in the returned object', async () => {
    const credentials = memoryCredentials()
    const secure = memorySecureStore()
    const directory = createConnectionDirectory(secure)
    const preferences = createAppPreferences(secure)
    const session = await persistSignedInSession({
      credentials,
      directory,
      preferences,
      serverUrl: 'https://worker.example.com',
      apiKey: secret,
      label: '店舗',
      staff: { name: '山田', role: 'admin' },
    })
    expect(session.connectionLabel).toBe('店舗')
    expect(session.role).toBe('admin')
    expect(session).not.toHaveProperty('apiKey')
    expect(JSON.stringify(session)).not.toContain(secret)
    expect(credentials.snapshot().key).toBe(secret)

    await clearActiveSession({ credentials, preferences })
    expect(credentials.snapshot()).toEqual({ url: null, key: null })
    expect(await preferences.getStaffProfile()).toBeNull()
    expect((await directory.list())).toHaveLength(1)
    expect(await directory.readApiKey(session.connectionId ?? '')).toBe(secret)
  })

  it('drops an active URL that contains a password', async () => {
    const credentials = memoryCredentials()
    await credentials.setServerUrl('https://user:secret-pass@worker.example.com')
    await credentials.setApiKey(secret)
    const secure = memorySecureStore()
    const session = await loadOrMigrateSession({
      credentials,
      directory: createConnectionDirectory(secure),
      preferences: createAppPreferences(secure),
    })
    expect(session).toBeNull()
    expect(credentials.snapshot()).toEqual({ url: null, key: null })
    expect(JSON.stringify(secure.dump())).not.toContain('secret-pass')
  })

  it('migrates a legacy active key into the saved list', async () => {
    const credentials = memoryCredentials()
    await credentials.setServerUrl('https://worker.example.com')
    await credentials.setApiKey(secret)
    const secure = memorySecureStore()
    const directory = createConnectionDirectory(secure)
    const session = await loadOrMigrateSession({
      credentials,
      directory,
      preferences: createAppPreferences(secure),
    })
    expect(session?.serverUrl).toBe('https://worker.example.com')
    expect(session?.connectionId).toBeTruthy()
    expect(JSON.stringify(session)).not.toContain(secret)
    expect(await directory.list()).toHaveLength(1)
  })
})

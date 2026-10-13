import { describe, expect, it } from 'vitest'

import { memorySecureStore } from './memory-secure-store'
import { createAppPreferences } from './preferences'
import { BIOMETRIC_LOCK_KEY, STAFF_PROFILE_KEY } from './storage-keys'

describe('app preferences', () => {
  it('stores the biometric flag as a single character', async () => {
    const store = memorySecureStore()
    const preferences = createAppPreferences(store)
    expect(await preferences.getBiometricEnabled()).toBe(false)
    await preferences.setBiometricEnabled(true)
    expect(store.dump()[BIOMETRIC_LOCK_KEY]).toBe('1')
    expect(await preferences.getBiometricEnabled()).toBe(true)
    await preferences.setBiometricEnabled(false)
    expect(store.dump()[BIOMETRIC_LOCK_KEY]).toBeUndefined()
  })

  it('drops extra fields from a stored staff profile', async () => {
    const store = memorySecureStore()
    await store.setItemAsync(
      STAFF_PROFILE_KEY,
      JSON.stringify({ name: '山田', role: 'admin', apiKey: 'phone-key' }),
    )
    const preferences = createAppPreferences(store)
    const profile = await preferences.getStaffProfile()
    expect(profile).toEqual({ name: '山田', role: 'admin' })
    expect(JSON.stringify(profile)).not.toContain('phone-key')
  })

  it('ignores an active connection id that is not an id', async () => {
    const store = memorySecureStore()
    const preferences = createAppPreferences(store)
    await preferences.setActiveConnectionId('not a valid id')
    expect(await preferences.getActiveConnectionId()).toBeNull()
    await preferences.setActiveConnectionId('abcdef0123456789')
    expect(await preferences.getActiveConnectionId()).toBe('abcdef0123456789')
  })
})

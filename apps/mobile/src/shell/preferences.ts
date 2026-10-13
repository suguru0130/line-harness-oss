import type { SecureStoreLike } from '@line-crm/admin-client'

import { parseOperatorRole, type OperatorRole } from './roles'
import { isRecord, readString } from './record'
import {
  ACTIVE_CONNECTION_ID_KEY,
  BIOMETRIC_LOCK_KEY,
  isConnectionId,
  SELECTED_LINE_ACCOUNT_KEY,
  STAFF_PROFILE_KEY,
} from './storage-keys'

export interface StoredStaffProfile {
  name: string
  role: OperatorRole | null
}

export interface AppPreferences {
  getBiometricEnabled(): Promise<boolean>
  setBiometricEnabled(enabled: boolean): Promise<void>
  getActiveConnectionId(): Promise<string | null>
  setActiveConnectionId(id: string | null): Promise<void>
  getSelectedLineAccountId(): Promise<string | null>
  setSelectedLineAccountId(id: string | null): Promise<void>
  getStaffProfile(): Promise<StoredStaffProfile | null>
  setStaffProfile(profile: StoredStaffProfile | null): Promise<void>
}

const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,80}$/

function parseStoredStaff(raw: string | null): StoredStaffProfile | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  const name = readString(parsed, 'name')
  if (!name) return null
  return {
    name: name.slice(0, 80),
    role: parseOperatorRole(readString(parsed, 'role')),
  }
}

export function createAppPreferences(store: SecureStoreLike): AppPreferences {
  return {
    async getBiometricEnabled() {
      return (await store.getItemAsync(BIOMETRIC_LOCK_KEY)) === '1'
    },
    async setBiometricEnabled(enabled) {
      if (enabled) await store.setItemAsync(BIOMETRIC_LOCK_KEY, '1')
      else await store.deleteItemAsync(BIOMETRIC_LOCK_KEY)
    },
    async getActiveConnectionId() {
      const value = await store.getItemAsync(ACTIVE_CONNECTION_ID_KEY)
      if (!value || !isConnectionId(value)) return null
      return value
    },
    async setActiveConnectionId(id) {
      if (id && isConnectionId(id)) await store.setItemAsync(ACTIVE_CONNECTION_ID_KEY, id)
      else await store.deleteItemAsync(ACTIVE_CONNECTION_ID_KEY)
    },
    async getSelectedLineAccountId() {
      const value = await store.getItemAsync(SELECTED_LINE_ACCOUNT_KEY)
      if (!value || !ACCOUNT_ID.test(value)) return null
      return value
    },
    async setSelectedLineAccountId(id) {
      if (id && ACCOUNT_ID.test(id)) await store.setItemAsync(SELECTED_LINE_ACCOUNT_KEY, id)
      else await store.deleteItemAsync(SELECTED_LINE_ACCOUNT_KEY)
    },
    async getStaffProfile() {
      return parseStoredStaff(await store.getItemAsync(STAFF_PROFILE_KEY))
    },
    async setStaffProfile(profile) {
      if (!profile) {
        await store.deleteItemAsync(STAFF_PROFILE_KEY)
        return
      }
      const payload = JSON.stringify({
        name: profile.name.slice(0, 80),
        role: profile.role,
      })
      await store.setItemAsync(STAFF_PROFILE_KEY, payload)
    },
  }
}

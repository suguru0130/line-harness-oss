import type { ApiCredentialStore } from '@line-crm/shared'

import type { ConnectionDirectory } from './connections'
import type { AppPreferences, StoredStaffProfile } from './preferences'
import type { OperatorRole } from './roles'
import { displayServerUrl } from './server-url'

export interface SignedInSession {
  serverUrl: string
  connectionId: string | null
  connectionLabel: string | null
  staffName: string | null
  role: OperatorRole | null
}

export async function clearActiveSession(deps: {
  credentials: ApiCredentialStore
  preferences: AppPreferences
}): Promise<void> {
  await deps.credentials.clear()
  await deps.preferences.setActiveConnectionId(null)
  await deps.preferences.setStaffProfile(null)
  await deps.preferences.setSelectedLineAccountId(null)
}

export async function persistSignedInSession(deps: {
  credentials: ApiCredentialStore
  directory: ConnectionDirectory
  preferences: AppPreferences
  serverUrl: string
  apiKey: string
  label?: string
  staff: StoredStaffProfile | null
}): Promise<SignedInSession> {
  const summary = await deps.directory.upsert({
    serverUrl: deps.serverUrl,
    apiKey: deps.apiKey,
    label: deps.label,
  })
  await deps.credentials.setServerUrl(summary.serverUrl)
  await deps.credentials.setApiKey(deps.apiKey)
  await deps.preferences.setActiveConnectionId(summary.id)
  await deps.preferences.setStaffProfile(deps.staff)
  return {
    serverUrl: summary.serverUrl,
    connectionId: summary.id,
    connectionLabel: summary.label,
    staffName: deps.staff?.name ?? null,
    role: deps.staff?.role ?? null,
  }
}

/**
 * 起動時に、いまの接続を読む。
 * URL にパスワードやクエリが入っていたら、その接続は消して null を返す。
 * 古いインストールで一覧が無いときは、今の鍵から一覧へ移す。
 */
export async function loadOrMigrateSession(deps: {
  credentials: ApiCredentialStore
  directory: ConnectionDirectory
  preferences: AppPreferences
}): Promise<SignedInSession | null> {
  const serverUrl = await deps.credentials.getServerUrl()
  const apiKey = await deps.credentials.getApiKey()
  if (!serverUrl || !apiKey) return null
  if (displayServerUrl(serverUrl) !== serverUrl) {
    await deps.directory.list()
    await clearActiveSession(deps)
    return null
  }

  const connections = await deps.directory.list()
  const activeId = await deps.preferences.getActiveConnectionId()
  let match =
    connections.find((item) => item.id === activeId) ??
    connections.find((item) => item.serverUrl === serverUrl) ??
    null
  if (!match) {
    try {
      match = await deps.directory.upsert({ serverUrl, apiKey })
      await deps.preferences.setActiveConnectionId(match.id)
    } catch {
      match = null
    }
  }
  const staff = await deps.preferences.getStaffProfile()
  return {
    serverUrl: match?.serverUrl ?? serverUrl,
    connectionId: match?.id ?? null,
    connectionLabel: match?.label ?? null,
    staffName: staff?.name ?? null,
    role: staff?.role ?? null,
  }
}

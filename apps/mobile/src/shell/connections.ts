import type { SecureStoreLike } from '@line-crm/admin-client'

import { connectionLabel, prepareServerUrl } from './server-url'
import {
  connectionSecretKey,
  createConnectionId,
  isConnectionId,
  SAVED_CONNECTIONS_KEY,
} from './storage-keys'
import { isRecord, readString } from './record'

export interface ConnectionSummary {
  id: string
  label: string
  serverUrl: string
}

export class ConnectionDirectoryError extends Error {
  constructor(readonly issue: 'too-many' | 'invalid-url' | 'url-has-secret') {
    super(issue)
    this.name = 'ConnectionDirectoryError'
  }
}

export interface ConnectionDirectory {
  list(): Promise<ConnectionSummary[]>
  upsert(input: { label?: string; serverUrl: string; apiKey: string }): Promise<ConnectionSummary>
  readApiKey(id: string): Promise<string | null>
  remove(id: string): Promise<void>
}

const MAX_CONNECTIONS = 20
const MAX_INDEX_LENGTH = 1800

async function writeIndex(store: SecureStoreLike, items: ConnectionSummary[]): Promise<void> {
  const payload = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      label: item.label,
      serverUrl: item.serverUrl,
    })),
  )
  if (payload.length > MAX_INDEX_LENGTH) {
    throw new ConnectionDirectoryError('too-many')
  }
  await store.setItemAsync(SAVED_CONNECTIONS_KEY, payload)
}

async function readIndex(store: SecureStoreLike): Promise<ConnectionSummary[]> {
  const raw = await store.getItemAsync(SAVED_CONNECTIONS_KEY)
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    await store.deleteItemAsync(SAVED_CONNECTIONS_KEY)
    return []
  }
  if (!Array.isArray(parsed)) {
    await store.deleteItemAsync(SAVED_CONNECTIONS_KEY)
    return []
  }

  const kept: ConnectionSummary[] = []
  const droppedIds: string[] = []
  let changed = false

  for (const item of parsed) {
    if (!isRecord(item)) {
      changed = true
      continue
    }
    const id = readString(item, 'id')
    const rawLabel = readString(item, 'label')
    const serverUrl = readString(item, 'serverUrl')
    if (!id || !rawLabel || !serverUrl || !isConnectionId(id)) {
      changed = true
      if (id && isConnectionId(id)) droppedIds.push(id)
      continue
    }
    const prepared = prepareServerUrl(serverUrl)
    if (!prepared.ok) {
      changed = true
      droppedIds.push(id)
      continue
    }
    const secret = await store.getItemAsync(connectionSecretKey(id))
    const label = connectionLabel({
      label: rawLabel,
      serverUrl: prepared.serverUrl,
      apiKey: secret ?? '',
    })
    if (label !== rawLabel || prepared.serverUrl !== serverUrl || 'apiKey' in item) {
      changed = true
    }
    kept.push({ id, label, serverUrl: prepared.serverUrl })
  }

  if (changed) {
    await writeIndex(store, kept)
    await Promise.all(droppedIds.map(async (id) => store.deleteItemAsync(connectionSecretKey(id))))
  }
  return kept
}

export function createConnectionDirectory(store: SecureStoreLike): ConnectionDirectory {
  return {
    list() {
      return readIndex(store)
    },
    async upsert(input) {
      const prepared = prepareServerUrl(input.serverUrl, input.apiKey)
      if (!prepared.ok) {
        throw new ConnectionDirectoryError(prepared.issue === 'has-secret' ? 'url-has-secret' : 'invalid-url')
      }
      const label = connectionLabel({
        label: input.label,
        serverUrl: prepared.serverUrl,
        apiKey: input.apiKey,
      })
      const current = await readIndex(store)
      const existing = current.find((item) => item.serverUrl === prepared.serverUrl && item.label === label)
      if (!existing && current.length >= MAX_CONNECTIONS) {
        throw new ConnectionDirectoryError('too-many')
      }
      const summary: ConnectionSummary = existing ?? {
        id: createConnectionId(),
        label,
        serverUrl: prepared.serverUrl,
      }
      const next = existing
        ? current.map((item) => (item.id === existing.id ? { id: item.id, label, serverUrl: prepared.serverUrl } : item))
        : [...current, summary]
      await writeIndex(store, next)
      await store.setItemAsync(connectionSecretKey(summary.id), input.apiKey)
      return { id: summary.id, label, serverUrl: prepared.serverUrl }
    },
    async readApiKey(id) {
      if (!isConnectionId(id)) return null
      return store.getItemAsync(connectionSecretKey(id))
    },
    async remove(id) {
      if (!isConnectionId(id)) return
      const current = await readIndex(store)
      await writeIndex(
        store,
        current.filter((item) => item.id !== id),
      )
      await store.deleteItemAsync(connectionSecretKey(id))
    },
  }
}

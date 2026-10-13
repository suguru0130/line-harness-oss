import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { api, mobileCredentialStore } from '@/lib/api'
import { connectionDirectory } from '@/lib/connections'
import { appPreferences } from '@/lib/preferences'
import { ConnectionDirectoryError, type ConnectionSummary } from '@/shell/connections'
import { probeApiKey, probeFailureMessage } from '@/shell/probe'
import { parseStaffSessionProfile } from '@/shell/profiles'
import { isUnauthorizedError } from '@/shell/public-error'
import {
  clearActiveSession,
  loadOrMigrateSession,
  persistSignedInSession,
  type SignedInSession,
} from '@/shell/session-store'

interface SessionContextValue extends SignedInSession {
  status: 'loading' | 'signedOut' | 'signedIn'
  connections: ConnectionSummary[]
  busy: boolean
  error: string | null
  clearError: () => void
  signIn: (input: { serverUrl: string; apiKey: string; label?: string }) => Promise<boolean>
  signInSaved: (id: string) => Promise<boolean>
  signOut: () => Promise<void>
  removeConnection: (id: string) => Promise<void>
}

const emptySession: SignedInSession = {
  serverUrl: '',
  connectionId: null,
  connectionLabel: null,
  staffName: null,
  role: null,
}

const SessionContext = createContext<SessionContextValue | null>(null)

function directoryMessage(error: unknown): string | null {
  if (!(error instanceof ConnectionDirectoryError)) return null
  if (error.issue === 'too-many') return '保存できる接続は20件までです'
  if (error.issue === 'url-has-secret') return probeFailureMessage('url-has-secret')
  return probeFailureMessage('invalid-url')
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionContextValue['status']>('loading')
  const [session, setSession] = useState<SignedInSession>(emptySession)
  const [connections, setConnections] = useState<ConnectionSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const generation = useRef(0)

  const applySignedOut = useCallback(() => {
    setSession(emptySession)
    setStatus('signedOut')
  }, [])

  const refreshStaff = useCallback(async () => {
    const ticket = generation.current
    try {
      const response = await api.staff.me()
      if (ticket !== generation.current) return
      if (!response.success) return
      const profile = parseStaffSessionProfile(response.data)
      if (!profile) return
      await appPreferences.setStaffProfile(profile)
      if (ticket !== generation.current) return
      setSession((current) => ({ ...current, staffName: profile.name, role: profile.role }))
    } catch (caught) {
      if (ticket !== generation.current || !isUnauthorizedError(caught)) return
      generation.current += 1
      await clearActiveSession({
        credentials: mobileCredentialStore,
        preferences: appPreferences,
      })
      applySignedOut()
      setError('APIキーが正しくありません')
    }
  }, [applySignedOut])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [loaded, saved] = await Promise.all([
          loadOrMigrateSession({
            credentials: mobileCredentialStore,
            directory: connectionDirectory,
            preferences: appPreferences,
          }),
          connectionDirectory.list(),
        ])
        if (cancelled) return
        setConnections(saved)
        if (!loaded) {
          applySignedOut()
          return
        }
        setSession(loaded)
        setStatus('signedIn')
        void refreshStaff()
      } catch {
        if (!cancelled) {
          applySignedOut()
          setError('接続設定を読み込めませんでした')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [applySignedOut, refreshStaff])

  const signIn = useCallback(
    async (input: { serverUrl: string; apiKey: string; label?: string }) => {
      if (busyRef.current) return false
      busyRef.current = true
      setBusy(true)
      setError(null)
      const ticket = generation.current + 1
      generation.current = ticket
      try {
        const apiKey = input.apiKey.trim()
        const probed = await probeApiKey({
          // 識別子の fetch を渡すとブラウザでは this が外れる。メソッド呼び出しにする。
          fetchImpl: (request, init) => globalThis.fetch(request, init),
          serverUrl: input.serverUrl,
          apiKey,
        })
        if (ticket !== generation.current) return false
        if (!probed.ok) {
          setError(probeFailureMessage(probed.reason))
          return false
        }
        const next = await persistSignedInSession({
          credentials: mobileCredentialStore,
          directory: connectionDirectory,
          preferences: appPreferences,
          serverUrl: probed.serverUrl,
          apiKey,
          label: input.label,
          staff: null,
        })
        if (ticket !== generation.current) return false
        setSession(next)
        setStatus('signedIn')
        setConnections(await connectionDirectory.list())
        void refreshStaff()
        return true
      } catch (caught) {
        if (ticket === generation.current) {
          setError(directoryMessage(caught) ?? '接続に失敗しました')
        }
        return false
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [refreshStaff],
  )

  const signInSaved = useCallback(
    async (id: string) => {
      const saved = (await connectionDirectory.list()).find((item) => item.id === id)
      if (!saved) {
        setError('この接続は見つかりません')
        return false
      }
      const apiKey = await connectionDirectory.readApiKey(id)
      if (!apiKey) {
        setError('この接続のAPIキーが見つかりません。もう一度入力してください')
        return false
      }
      return signIn({ serverUrl: saved.serverUrl, apiKey, label: saved.label })
    },
    [signIn],
  )

  const signOut = useCallback(async () => {
    generation.current += 1
    await clearActiveSession({
      credentials: mobileCredentialStore,
      preferences: appPreferences,
    })
    setConnections(await connectionDirectory.list())
    setError(null)
    applySignedOut()
  }, [applySignedOut])

  const removeConnection = useCallback(
    async (id: string) => {
      const activeId = await appPreferences.getActiveConnectionId()
      await connectionDirectory.remove(id)
      if (activeId === id) {
        await signOut()
        return
      }
      setConnections(await connectionDirectory.list())
    },
    [signOut],
  )

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      ...session,
      connections,
      busy,
      error,
      clearError,
      signIn,
      signInSaved,
      signOut,
      removeConnection,
    }),
    [status, session, connections, busy, error, clearError, signIn, signInSaved, signOut, removeConnection],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used within SessionProvider')
  return value
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '@/lib/api'
import { appPreferences } from '@/lib/preferences'
import { useSession } from '@/providers/session-provider'
import { parseLineAccountList, type LineAccountSummary } from '@/shell/profiles'
import { publicApiError } from '@/shell/public-error'

interface LineAccountContextValue {
  status: 'idle' | 'loading' | 'ready' | 'error'
  accounts: LineAccountSummary[]
  selected: LineAccountSummary | null
  error: string | null
  select: (id: string) => Promise<void>
  reload: () => void
}

const LineAccountContext = createContext<LineAccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const signedIn = session.status === 'signedIn'
  const serverUrl = signedIn ? session.serverUrl : ''
  const connectionId = signedIn ? (session.connectionId ?? '') : ''
  const [retry, setRetry] = useState(0)
  const requestKey = signedIn ? `${serverUrl}\n${connectionId}\n${retry}` : ''
  const [resultKey, setResultKey] = useState('')
  const [accounts, setAccounts] = useState<LineAccountSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!requestKey) return
    let cancelled = false
    api.lineAccounts
      .list()
      .then(async (response) => {
        if (cancelled) return
        if (!response.success) {
          setAccounts([])
          setSelectedId(null)
          setError('LINEアカウントを読み込めませんでした')
          setResultKey(requestKey)
          return
        }
        const list = parseLineAccountList(response.data)
        const stored = await appPreferences.getSelectedLineAccountId()
        if (cancelled) return
        const nextId = stored && list.some((account) => account.id === stored) ? stored : (list[0]?.id ?? null)
        if (nextId) await appPreferences.setSelectedLineAccountId(nextId)
        if (cancelled) return
        setAccounts(list)
        setSelectedId(nextId)
        setError(null)
        setResultKey(requestKey)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setAccounts([])
        setSelectedId(null)
        setError(publicApiError(caught, 'LINEアカウントを読み込めませんでした'))
        setResultKey(requestKey)
      })
    return () => {
      cancelled = true
    }
  }, [requestKey])

  const status: LineAccountContextValue['status'] =
    requestKey === '' ? 'idle' : resultKey === requestKey ? (error ? 'error' : 'ready') : 'loading'

  const select = useCallback(async (id: string) => {
    setSelectedId(id)
    await appPreferences.setSelectedLineAccountId(id)
  }, [])

  const reload = useCallback(() => {
    setRetry((value) => value + 1)
  }, [])

  const value = useMemo<LineAccountContextValue>(() => {
    const visibleAccounts = status === 'ready' ? accounts : []
    return {
      status,
      accounts: visibleAccounts,
      selected: visibleAccounts.find((account) => account.id === selectedId) ?? null,
      error: status === 'error' ? error : null,
      select,
      reload,
    }
  }, [status, accounts, selectedId, error, select, reload])

  return <LineAccountContext.Provider value={value}>{children}</LineAccountContext.Provider>
}

export function useLineAccount(): LineAccountContextValue {
  const value = useContext(LineAccountContext)
  if (!value) throw new Error('useLineAccount must be used within AccountProvider')
  return value
}

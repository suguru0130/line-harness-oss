import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AppState, View } from 'react-native'

import { AppLockScreen } from '@/components/app-lock-screen'
import { LoadingState } from '@/components/ui/states'
import { getBiometricAvailability, promptBiometricUnlock } from '@/lib/biometric'
import { appPreferences } from '@/lib/preferences'
import { shouldLockOnAppState, type AppLockState } from '@/shell/app-lock'

interface AppLockContextValue {
  enabled: boolean
  available: boolean
  notice: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
}

const AppLockContext = createContext<AppLockContextValue | null>(null)

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)
  const [locked, setLocked] = useState(false)
  const [admitted, setAdmitted] = useState(false)
  const [prompting, setPrompting] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [resumeTick, setResumeTick] = useState(0)
  const promptingRef = useRef(false)
  const enabledRef = useRef(false)
  const prompted = useRef(false)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [flag, availability] = await Promise.all([
        appPreferences.getBiometricEnabled(),
        getBiometricAvailability(),
      ])
      if (cancelled) return
      const canUse = availability === 'ready'
      setAvailable(canUse)
      setEnabled(flag)
      setLocked(flag)
      setAdmitted(!flag)
      setRecovery(flag && !canUse)
      setReady(true)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const nextState = next as AppLockState
      if (shouldLockOnAppState({ nextState, enabled: enabledRef.current, prompting: promptingRef.current })) {
        prompted.current = false
        setLocked(true)
        setRecovery(false)
        return
      }
      if (next === 'active') setResumeTick((value) => value + 1)
    })
    return () => subscription.remove()
  }, [])

  const runPrompt = useCallback(async (message: string) => {
    promptingRef.current = true
    setPrompting(true)
    try {
      return await promptBiometricUnlock(message)
    } finally {
      promptingRef.current = false
      setPrompting(false)
    }
  }, [])

  const unlock = useCallback(async () => {
    const result = await runPrompt('L-SP のロックを解除')
    if (result === 'success') {
      setLocked(false)
      setAdmitted(true)
      setRecovery(false)
      return
    }
    if (result === 'unavailable') setRecovery(true)
  }, [runPrompt])

  const recover = useCallback(async () => {
    await appPreferences.setBiometricEnabled(false)
    setEnabled(false)
    setLocked(false)
    setAdmitted(true)
    setRecovery(false)
    setNotice('生体認証が使えなくなったので、ロックをオフにしました')
  }, [])

  const enable = useCallback(async () => {
    setNotice(null)
    if (!available) {
      setNotice('この端末では生体認証を使えません')
      return
    }
    const result = await runPrompt('生体認証ロックをオンにします')
    if (result === 'unavailable') {
      setAvailable(false)
      setNotice('この端末では生体認証を使えません')
      return
    }
    if (result !== 'success') return
    await appPreferences.setBiometricEnabled(true)
    setEnabled(true)
  }, [available, runPrompt])

  const disable = useCallback(async () => {
    setNotice(null)
    const result = await runPrompt('生体認証ロックをオフにします')
    if (result !== 'success') {
      if (result === 'unavailable') setNotice('この端末では生体認証を使えません')
      return
    }
    await appPreferences.setBiometricEnabled(false)
    setEnabled(false)
    setLocked(false)
  }, [runPrompt])

  useEffect(() => {
    if (!locked) prompted.current = false
  }, [locked])

  useEffect(() => {
    if (!ready || !locked || recovery) return
    if (AppState.currentState !== 'active') return
    if (prompted.current) return
    prompted.current = true
    void unlock()
  }, [ready, locked, recovery, unlock, resumeTick])

  const value = useMemo(
    () => ({ enabled, available, notice, enable, disable }),
    [enabled, available, notice, enable, disable],
  )

  return (
    <AppLockContext.Provider value={value}>
      <View className="flex-1">
        {ready ? null : (
          <View className="flex-1 items-center justify-center bg-white">
            <LoadingState message="起動しています" />
          </View>
        )}
        {ready && admitted ? children : null}
        {ready && locked ? (
          <View className="absolute inset-0 z-50 bg-white">
            <AppLockScreen prompting={prompting} recovery={recovery} onUnlock={() => void unlock()} onRecover={() => void recover()} />
          </View>
        ) : null}
      </View>
    </AppLockContext.Provider>
  )
}

export function useAppLock(): AppLockContextValue {
  const value = useContext(AppLockContext)
  if (!value) throw new Error('useAppLock must be used within AppLockProvider')
  return value
}

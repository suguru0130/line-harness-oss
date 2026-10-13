'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { webCredentialStore } from '@/lib/credential-store'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (pathname === '/login') {
        setChecked(true)
        return
      }
      try {
        const key = await webCredentialStore.getApiKey()
        if (cancelled) return
        if (!key) {
          router.replace('/login')
        } else {
          setChecked(true)
        }
      } catch {
        if (!cancelled) router.replace('/login')
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-[3px] border-gray-200 border-t-green-500 rounded-full" />
      </div>
    )
  }

  return <>{children}</>
}

import type { ReactNode } from 'react'

import { roleAtLeast, type OperatorRole } from '@/shell/roles'

export function RoleGate({
  role,
  minimum,
  children,
  fallback = null,
}: {
  role: OperatorRole | null
  minimum: OperatorRole
  children: ReactNode
  fallback?: ReactNode
}) {
  if (!roleAtLeast(role, minimum)) return <>{fallback}</>
  return <>{children}</>
}

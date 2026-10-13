export const OPERATOR_ROLES = ['owner', 'admin', 'staff'] as const

export type OperatorRole = (typeof OPERATOR_ROLES)[number]

const RANK: Record<OperatorRole, number> = {
  staff: 1,
  admin: 2,
  owner: 3,
}

export function parseOperatorRole(value: string | null | undefined): OperatorRole | null {
  if (value === 'owner' || value === 'admin' || value === 'staff') return value
  return null
}

/** 権限が不明なときは false。権限が要る操作は出さない。 */
export function roleAtLeast(role: OperatorRole | null, minimum: OperatorRole): boolean {
  if (!role) return false
  return RANK[role] >= RANK[minimum]
}

export function roleLabel(role: OperatorRole | null): string {
  if (role === 'owner') return 'オーナー'
  if (role === 'admin') return '管理者'
  if (role === 'staff') return 'スタッフ'
  return '権限未確認'
}

/** 配信の作成と ON/OFF。決定事項では admin 以上。 */
export function canManageBroadcasts(role: OperatorRole | null): boolean {
  return roleAtLeast(role, 'admin')
}

/** スタッフの追加と削除。Worker は owner だけ。 */
export function canManageStaff(role: OperatorRole | null): boolean {
  return role === 'owner'
}

/** LINE アカウントの名前や国などの編集。Worker の PATCH は admin 以上。 */
export function canEditLineAccounts(role: OperatorRole | null): boolean {
  return roleAtLeast(role, 'admin')
}

/** LINE アカウントの追加、削除、トークンの更新。Worker は owner だけ。 */
export function canAdministerLineAccounts(role: OperatorRole | null): boolean {
  return role === 'owner'
}

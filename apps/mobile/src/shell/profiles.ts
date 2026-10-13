import { parseOperatorRole, type OperatorRole } from './roles'
import { isRecord, readString } from './record'

export interface LineAccountSummary {
  id: string
  name: string
  displayName: string
  pictureUrl: string | null
  basicId: string | null
  isActive: boolean
  country: string | null
  /** LINE アカウントに付いた表示用のラベル。スタッフ権限とは別。 */
  accountRole: string | null
  displayOrder: number
}

export interface StaffSessionProfile {
  name: string
  role: OperatorRole | null
}

const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,80}$/

function clip(value: string | null, max: number): string | null {
  if (!value) return null
  return value.slice(0, max)
}

function httpsUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/** 一覧 API から、画面に出してよい項目だけ取る。トークンは捨てる。 */
export function parseLineAccountSummary(value: unknown): LineAccountSummary | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const name = readString(value, 'name')
  if (!id || !name || !ACCOUNT_ID.test(id)) return null
  const displayName = clip(readString(value, 'displayName'), 80) ?? clip(name, 80) ?? name.slice(0, 80)
  const order = value.displayOrder
  return {
    id,
    name: name.slice(0, 80),
    displayName,
    pictureUrl: httpsUrl(readString(value, 'pictureUrl')),
    basicId: clip(readString(value, 'basicId'), 40),
    isActive: value.isActive !== false,
    country: clip(readString(value, 'country'), 40),
    accountRole: clip(readString(value, 'role'), 40),
    displayOrder: typeof order === 'number' && Number.isFinite(order) ? order : 0,
  }
}

export function sortLineAccounts(accounts: readonly LineAccountSummary[]): LineAccountSummary[] {
  return [...accounts].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.displayName.localeCompare(b.displayName, 'ja'),
  )
}

export function parseLineAccountList(value: unknown): LineAccountSummary[] {
  if (!Array.isArray(value)) return []
  const parsed = value
    .map((item) => parseLineAccountSummary(item))
    .filter((item): item is LineAccountSummary => item !== null)
  return sortLineAccounts(parsed)
}

export function parseStaffSessionProfile(value: unknown): StaffSessionProfile | null {
  if (!isRecord(value)) return null
  const name = readString(value, 'name')
  if (!name) return null
  return {
    name: name.slice(0, 80),
    role: parseOperatorRole(readString(value, 'role')),
  }
}

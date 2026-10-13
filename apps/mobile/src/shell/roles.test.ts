import { describe, expect, it } from 'vitest'

import {
  canAdministerLineAccounts,
  canEditLineAccounts,
  canManageBroadcasts,
  canManageStaff,
  parseOperatorRole,
  roleAtLeast,
  roleLabel,
} from './roles'

describe('operator roles', () => {
  it('parses only owner, admin, and staff', () => {
    expect(parseOperatorRole('owner')).toBe('owner')
    expect(parseOperatorRole('admin')).toBe('admin')
    expect(parseOperatorRole('staff')).toBe('staff')
    expect(parseOperatorRole('operator')).toBeNull()
    expect(parseOperatorRole(null)).toBeNull()
  })

  it('treats owner as satisfying admin actions, and unknown as none', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true)
    expect(roleAtLeast('admin', 'admin')).toBe(true)
    expect(roleAtLeast('staff', 'admin')).toBe(false)
    expect(roleAtLeast(null, 'staff')).toBe(false)
  })

  it('matches the broadcast and account rules', () => {
    expect(canManageBroadcasts('staff')).toBe(false)
    expect(canManageBroadcasts('admin')).toBe(true)
    expect(canManageBroadcasts('owner')).toBe(true)
    expect(canManageStaff('admin')).toBe(false)
    expect(canManageStaff('owner')).toBe(true)
    expect(canEditLineAccounts('staff')).toBe(false)
    expect(canEditLineAccounts('admin')).toBe(true)
    expect(canAdministerLineAccounts('admin')).toBe(false)
    expect(canAdministerLineAccounts('owner')).toBe(true)
  })

  it('labels roles in Japanese without inventing a role', () => {
    expect(roleLabel('owner')).toBe('オーナー')
    expect(roleLabel('admin')).toBe('管理者')
    expect(roleLabel('staff')).toBe('スタッフ')
    expect(roleLabel(null)).toBe('権限未確認')
  })
})

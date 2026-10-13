import { describe, expect, it } from 'vitest'

import { parseLineAccountList, parseLineAccountSummary, parseStaffSessionProfile } from './profiles'

describe('parseLineAccountSummary', () => {
  it('keeps public fields and drops channel secrets', () => {
    const parsed = parseLineAccountSummary({
      id: 'account-1',
      name: '本店',
      displayName: '本店LINE',
      pictureUrl: 'https://profile.line-scdn.net/example',
      basicId: '@shop',
      isActive: true,
      country: '日本',
      role: '本店',
      displayOrder: 2,
      channelAccessToken: 'secret-token',
      channelSecret: 'secret-channel',
      loginChannelSecret: 'secret-login',
    })
    expect(parsed).toMatchObject({
      id: 'account-1',
      displayName: '本店LINE',
      pictureUrl: 'https://profile.line-scdn.net/example',
      accountRole: '本店',
      displayOrder: 2,
    })
    const encoded = JSON.stringify(parsed)
    expect(encoded).not.toContain('secret-token')
    expect(encoded).not.toContain('secret-channel')
    expect(encoded).not.toContain('secret-login')
    expect(parsed).not.toHaveProperty('channelAccessToken')
  })

  it('rejects a picture URL that is not https', () => {
    const parsed = parseLineAccountSummary({
      id: 'account-1',
      name: '本店',
      pictureUrl: 'javascript:alert(1)',
    })
    expect(parsed?.pictureUrl).toBeNull()
    expect(JSON.stringify(parsed)).not.toContain('javascript')
  })

  it('sorts by display order', () => {
    const accounts = parseLineAccountList([
      { id: 'b', name: '後', displayOrder: 2 },
      { id: 'a', name: '先', displayOrder: 1 },
    ])
    expect(accounts.map((account) => account.id)).toEqual(['a', 'b'])
  })
})

describe('parseStaffSessionProfile', () => {
  it('keeps the name and role and drops a key field', () => {
    const profile = parseStaffSessionProfile({
      id: 'staff-1',
      name: '山田',
      role: 'owner',
      apiKey: 'phone-key',
    })
    expect(profile).toEqual({ name: '山田', role: 'owner' })
    expect(JSON.stringify(profile)).not.toContain('phone-key')
    expect(parseStaffSessionProfile({ name: '山田', role: 'operator' })?.role).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { shouldLockOnAppState } from './app-lock'
import { visibleMoreLinks, type MoreLink } from './more-links'

describe('shouldLockOnAppState', () => {
  it('locks only when the app is backgrounded and a prompt is not open', () => {
    expect(shouldLockOnAppState({ nextState: 'background', enabled: true, prompting: false })).toBe(true)
    expect(shouldLockOnAppState({ nextState: 'inactive', enabled: true, prompting: false })).toBe(false)
    expect(shouldLockOnAppState({ nextState: 'background', enabled: true, prompting: true })).toBe(false)
    expect(shouldLockOnAppState({ nextState: 'background', enabled: false, prompting: false })).toBe(false)
    expect(shouldLockOnAppState({ nextState: 'active', enabled: true, prompting: false })).toBe(false)
  })
})

describe('visibleMoreLinks', () => {
  const links: MoreLink[] = [
    { id: 'settings', href: '/more/settings', title: '設定', description: '接続' },
    { id: 'staff', href: '/more/staff', title: 'スタッフ', description: '管理', minimumRole: 'owner' },
  ]

  it('hides owner links from staff and keeps them for the owner', () => {
    expect(visibleMoreLinks(links, 'staff').map((link) => link.id)).toEqual(['settings'])
    expect(visibleMoreLinks(links, 'owner').map((link) => link.id)).toEqual(['settings', 'staff'])
    expect(visibleMoreLinks(links, null).map((link) => link.id)).toEqual(['settings'])
  })
})

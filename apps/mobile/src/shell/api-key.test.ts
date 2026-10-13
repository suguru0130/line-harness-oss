import { describe, expect, it } from 'vitest'

import { checkApiKey } from './api-key'

describe('checkApiKey', () => {
  it('trims and rejects an empty key', () => {
    expect(checkApiKey('  phone-key  ')).toEqual({ ok: true, apiKey: 'phone-key' })
    expect(checkApiKey('   ')).toEqual({ ok: false, issue: 'empty' })
  })

  it('rejects a key that cannot fit in secure storage', () => {
    const result = checkApiKey('a'.repeat(2049))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issue).toBe('too-long')
  })
})

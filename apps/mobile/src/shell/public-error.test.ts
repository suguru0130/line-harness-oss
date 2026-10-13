import { describe, expect, it } from 'vitest'

import { isUnauthorizedError, publicApiError } from './public-error'

describe('publicApiError', () => {
  it('keeps only an HTTP status from API errors', () => {
    expect(publicApiError(new Error('API error: 401'), '読み込めませんでした')).toBe(
      '読み込めませんでした（HTTP 401）',
    )
  })

  it('drops messages that are not a bare status', () => {
    const error = new Error('API error: 401 Bearer phone-key')
    const message = publicApiError(error, '読み込めませんでした')
    expect(message).toBe('読み込めませんでした')
    expect(message).not.toContain('phone-key')
  })

  it('detects only the exact unauthorized error', () => {
    expect(isUnauthorizedError(new Error('API error: 401'))).toBe(true)
    expect(isUnauthorizedError(new Error('API error: 401 phone-key'))).toBe(false)
  })
})

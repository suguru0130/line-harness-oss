import { describe, expect, it } from 'vitest'

import { connectionLabel, displayServerUrl, prepareServerUrl } from './server-url'

const secret = 'phone-key'

describe('prepareServerUrl', () => {
  it('accepts an http(s) origin', () => {
    expect(prepareServerUrl('https://worker.example.com/')).toEqual({
      ok: true,
      serverUrl: 'https://worker.example.com',
    })
  })

  it('rejects secrets embedded in the URL', () => {
    expect(prepareServerUrl('https://user:secret-pass@worker.example.com').ok).toBe(false)
    expect(prepareServerUrl(`https://worker.example.com/?token=${secret}`, secret).ok).toBe(false)
    expect(prepareServerUrl(`https://worker.example.com/${secret}`, secret).ok).toBe(false)
    expect(prepareServerUrl('javascript:alert(1)').ok).toBe(false)
  })
})

describe('displayServerUrl', () => {
  it('drops userinfo and query before the URL is shown', () => {
    const shown = displayServerUrl('https://user:secret-pass@worker.example.com/path?token=secret-pass')
    expect(shown).toBe('https://worker.example.com/path')
    expect(shown).not.toContain('secret-pass')
  })

  it('returns an empty string for a non-http URL', () => {
    expect(displayServerUrl('javascript:alert(1)')).toBe('')
  })
})

describe('connectionLabel', () => {
  it('uses the host when the label is blank or equal to the key', () => {
    expect(connectionLabel({ serverUrl: 'https://worker.example.com', apiKey: secret, label: '  ' })).toBe(
      'worker.example.com',
    )
    expect(connectionLabel({ serverUrl: 'https://worker.example.com', apiKey: secret, label: secret })).toBe(
      'worker.example.com',
    )
    expect(connectionLabel({ serverUrl: 'https://worker.example.com', apiKey: secret, label: '店舗' })).toBe('店舗')
  })
})

import { describe, expect, it } from 'vitest'
import { describeCredentialState } from './credential-status'

describe('describeCredentialState', () => {
  it('does not include the secret itself', () => {
    const text = describeCredentialState({
      serverUrl: 'https://worker.example.com',
      apiKey: 'super-secret',
    })
    expect(text).not.toContain('super-secret')
    expect(text).not.toContain('worker.example.com')
    expect(text).toContain('保存されています')
  })

  it('says both are missing on a fresh install', () => {
    expect(describeCredentialState({ serverUrl: null, apiKey: null })).toContain('まだ')
  })
})

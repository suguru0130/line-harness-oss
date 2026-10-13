import { describe, expect, it } from 'vitest'

import { probeApiKey, probeFailureMessage } from './probe'

const secret = 'phone-key'

describe('probeApiKey', () => {
  it('checks the server without the key, then sends the key only if it stayed put', async () => {
    const calls: { url: string; authorization: string | null }[] = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      calls.push({ url, authorization: headers.get('Authorization') })
      const response = new Response(JSON.stringify({ success: true }), { status: headers.has('Authorization') ? 200 : 401 })
      Object.defineProperty(response, 'url', { value: url })
      return response
    }

    const result = await probeApiKey({
      fetchImpl,
      serverUrl: 'https://worker.example.com',
      apiKey: secret,
    })
    expect(result).toEqual({ ok: true, serverUrl: 'https://worker.example.com' })
    expect(calls).toHaveLength(2)
    expect(calls[0]?.authorization).toBeNull()
    expect(calls[1]?.authorization).toBe(`Bearer ${secret}`)
    expect(calls.every((call) => !call.url.includes(secret))).toBe(true)
  })

  it('does not send the key when the first response is a redirect', async () => {
    const calls: string[] = []
    const fetchImpl = async (url: string) => {
      calls.push(url)
      return new Response(null, { status: 302, headers: { Location: 'https://evil.example/steal' } })
    }
    const result = await probeApiKey({
      fetchImpl,
      serverUrl: 'https://worker.example.com',
      apiKey: secret,
    })
    expect(result).toEqual({ ok: false, reason: 'redirect' })
    expect(calls).toHaveLength(1)
  })

  it('does not call the network for a URL that contains the key', async () => {
    let called = false
    const result = await probeApiKey({
      fetchImpl: async () => {
        called = true
        return new Response(null, { status: 200 })
      },
      serverUrl: `https://worker.example.com/${secret}`,
      apiKey: secret,
    })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('maps a rejected key to a fixed message', async () => {
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      const status = headers.has('Authorization') ? 401 : 401
      const response = new Response('{}', { status })
      Object.defineProperty(response, 'url', { value: 'https://worker.example.com/api/friends/count' })
      return response
    }
    const result = await probeApiKey({
      fetchImpl,
      serverUrl: 'https://worker.example.com',
      apiKey: secret,
    })
    expect(result).toEqual({ ok: false, reason: 'unauthorized' })
    const message = probeFailureMessage('unauthorized')
    expect(message).toBe('APIキーが正しくありません')
    expect(message).not.toContain(secret)
  })
})

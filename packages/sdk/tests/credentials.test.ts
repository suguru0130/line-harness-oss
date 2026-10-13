import { describe, expect, it, vi } from 'vitest'
import { LineHarness } from '../src/client.js'
import { HttpClient } from '../src/http.js'

describe('pluggable credentials', () => {
  it('constructs LineHarness from a store without a baked API key', () => {
    const client = new LineHarness({
      credentials: {
        getServerUrl: async () => 'https://worker.example.com',
        getApiKey: async () => 'mobile-key',
      },
    })
    expect(client.friends).toBeDefined()
    expect(() => client.getAuthUrl()).toThrow(/apiUrl/)
  })

  it('reads the store on every request', async () => {
    let apiKey = 'first'
    const http = new HttpClient({
      baseUrl: 'https://unused.example.com',
      apiKey: 'unused',
      timeout: 5000,
      credentials: {
        getServerUrl: async () => 'https://override.example.com',
        getApiKey: async () => apiKey,
      },
    })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await http.get('/api/friends')
    apiKey = 'second'
    await http.get('/api/tags')

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://override.example.com/api/friends',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer first' }),
      }),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://override.example.com/api/tags',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer second' }),
      }),
    )
    vi.unstubAllGlobals()
  })
})

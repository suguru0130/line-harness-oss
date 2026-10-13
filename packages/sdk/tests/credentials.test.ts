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

  it('does not send the API key when the server URL is not http(s)', async () => {
    const http = new HttpClient({
      baseUrl: 'https://unused.example.com',
      apiKey: 'unused',
      timeout: 5000,
      credentials: {
        getServerUrl: async () => 'file:///tmp/secret',
        getApiKey: async () => 'mobile-key',
      },
    })
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    await expect(http.get('/api/friends')).rejects.toThrow(/http/)
    expect(mockFetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('treats an empty stored key as unset and uses the constructor key', async () => {
    const http = new HttpClient({
      baseUrl: 'https://unused.example.com',
      apiKey: 'baked-key',
      timeout: 5000,
      credentials: {
        getServerUrl: async () => 'https://override.example.com/',
        getApiKey: async () => '',
      },
    })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
    vi.stubGlobal('fetch', mockFetch)
    await http.get('/api/friends')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://override.example.com/api/friends',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer baked-key' }),
      }),
    )
    vi.unstubAllGlobals()
  })
})

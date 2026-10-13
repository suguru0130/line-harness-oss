import { afterEach, describe, expect, it } from 'vitest'

import { installBoundFetch } from './bind-fetch'

const original = globalThis.fetch

afterEach(() => {
  globalThis.fetch = original
})

describe('installBoundFetch', () => {
  it('lets a strict caller use fetch when the host function rejects a missing this', async () => {
    const seen: string[] = []
    function native(this: unknown, input: RequestInfo | URL) {
      if (this === undefined) throw new TypeError('Illegal invocation')
      seen.push(String(input))
      return Promise.resolve(new Response('ok'))
    }
    globalThis.fetch = native as typeof fetch
    installBoundFetch()

    const loose = globalThis.fetch
    const response = await loose('https://example.test/probe')
    expect(response.ok).toBe(true)
    expect(seen).toEqual(['https://example.test/probe'])
  })
})

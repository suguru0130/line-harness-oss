import { normalizeServerUrl } from '@line-crm/shared'

export type ServerUrlIssue = 'invalid' | 'has-secret'

export function prepareServerUrl(
  input: string,
  apiKey?: string,
): { ok: true; serverUrl: string } | { ok: false; issue: ServerUrlIssue } {
  let normalized: string
  try {
    normalized = normalizeServerUrl(input)
  } catch {
    return { ok: false, issue: 'invalid' }
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return { ok: false, issue: 'invalid' }
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { ok: false, issue: 'has-secret' }
  }
  if (apiKey && apiKey.length >= 8 && normalized.includes(apiKey)) {
    return { ok: false, issue: 'has-secret' }
  }
  return { ok: true, serverUrl: normalized }
}

/** 画面に出してよい URL。ユーザー名、パスワード、クエリ、フラグメントは除く。 */
export function displayServerUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function connectionLabel(input: { label?: string; serverUrl: string; apiKey: string }): string {
  const host = new URL(input.serverUrl).host
  const trimmed = (input.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!trimmed || (input.apiKey.length > 0 && trimmed === input.apiKey)) return host
  return trimmed
}

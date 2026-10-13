export type ApiKeyIssue = 'empty' | 'too-long'

const MAX_API_KEY_LENGTH = 2048

export function checkApiKey(
  value: string,
): { ok: true; apiKey: string } | { ok: false; issue: ApiKeyIssue } {
  const apiKey = value.trim()
  if (!apiKey) return { ok: false, issue: 'empty' }
  if (apiKey.length > MAX_API_KEY_LENGTH) return { ok: false, issue: 'too-long' }
  return { ok: true, apiKey }
}

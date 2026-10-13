export function describeCredentialState(input: {
  serverUrl: string | null
  apiKey: string | null
}): string {
  const hasUrl = Boolean(input.serverUrl)
  const hasKey = Boolean(input.apiKey)
  if (hasUrl && hasKey) return 'サーバー URL と API キーは端末に保存されています'
  if (hasKey) return 'API キーは端末に保存されています'
  if (hasUrl) return 'サーバー URL は端末に保存されています'
  return 'サーバー URL と API キーはまだ保存されていません'
}

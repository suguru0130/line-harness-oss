import { checkApiKey } from './api-key'
import { prepareServerUrl } from './server-url'

export type ProbeReason =
  | 'invalid-url'
  | 'url-has-secret'
  | 'key-empty'
  | 'key-too-long'
  | 'unauthorized'
  | 'redirect'
  | 'unreachable'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export function probeFailureMessage(reason: ProbeReason): string {
  switch (reason) {
    case 'invalid-url':
      return 'サーバー URL は http:// または https:// で始まる必要があります'
    case 'url-has-secret':
      return 'サーバー URL にパスワードやクエリは入れられません'
    case 'key-empty':
      return 'APIキーを入力してください'
    case 'key-too-long':
      return 'APIキーが長すぎてこの端末に保存できません'
    case 'unauthorized':
      return 'APIキーが正しくありません'
    case 'redirect':
      return 'サーバー URL が別のアドレスへ転送しています。転送先には接続しません'
    case 'unreachable':
      return '接続に失敗しました'
  }
}

function isRedirect(response: Response): boolean {
  if (response.status >= 300 && response.status < 400) return true
  if (response.status === 0) return true
  return response.type === 'opaqueredirect'
}

function stayedOnServer(response: Response, serverUrl: string): boolean {
  if (!response.url) return true
  return response.url.startsWith(`${serverUrl}/`) || response.url === serverUrl
}

/**
 * Web のログインと同じく /api/friends/count で鍵を確かめる。
 * 先に鍵なしで転送を見て、転送先には鍵を送らない。
 */
export async function probeApiKey(input: {
  fetchImpl: FetchLike
  serverUrl: string
  apiKey: string
}): Promise<{ ok: true; serverUrl: string } | { ok: false; reason: ProbeReason }> {
  const prepared = prepareServerUrl(input.serverUrl, input.apiKey)
  if (!prepared.ok) {
    return { ok: false, reason: prepared.issue === 'has-secret' ? 'url-has-secret' : 'invalid-url' }
  }
  const key = checkApiKey(input.apiKey)
  if (!key.ok) {
    return { ok: false, reason: key.issue === 'too-long' ? 'key-too-long' : 'key-empty' }
  }

  const probeUrl = `${prepared.serverUrl}/api/friends/count`
  let anonymous: Response
  try {
    anonymous = await input.fetchImpl(probeUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    })
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
  if (isRedirect(anonymous) || !stayedOnServer(anonymous, prepared.serverUrl)) {
    return { ok: false, reason: 'redirect' }
  }

  let authed: Response
  try {
    authed = await input.fetchImpl(probeUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key.apiKey}`,
      },
    })
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
  if (isRedirect(authed) || !stayedOnServer(authed, prepared.serverUrl)) {
    return { ok: false, reason: 'redirect' }
  }
  if (authed.status === 401 || authed.status === 403) {
    return { ok: false, reason: 'unauthorized' }
  }
  if (!authed.ok) return { ok: false, reason: 'unreachable' }
  return { ok: true, serverUrl: prepared.serverUrl }
}

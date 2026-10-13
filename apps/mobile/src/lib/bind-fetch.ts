const MARK = Symbol.for('line-crm.bound-fetch')

/**
 * ブラウザの fetch は Window のメソッド。
 * Expo Web の strict なモジュールから fetch() とだけ呼ぶと this が外れ、
 * 通信せず「接続に失敗しました」になる。普通の関数で包む。
 */
export function installBoundFetch(): void {
  const current = globalThis.fetch
  if (typeof current !== 'function') return
  if (MARK in current) return
  const bound = current.bind(globalThis)
  const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => bound(input, init)) as typeof fetch
  Object.defineProperty(wrapped, MARK, { value: true })
  globalThis.fetch = wrapped
}

installBoundFetch()

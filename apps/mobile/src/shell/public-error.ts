/** 画面に出してよい文言だけを返す。応答本文は載せない。 */
export function publicApiError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const match = /^API error: (\d{3})$/.exec(error.message)
    if (match) return `${fallback}（HTTP ${match[1]}）`
  }
  return fallback
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'API error: 401'
}

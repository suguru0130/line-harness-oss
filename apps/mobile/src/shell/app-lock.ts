export type AppLockState = 'active' | 'background' | 'inactive' | 'unknown' | 'extension'

/**
 * 生体認証のダイアログ表示中はロックしない。
 * iOS はダイアログ中に inactive になるので、background のときだけロックする。
 */
export function shouldLockOnAppState(input: {
  nextState: AppLockState
  enabled: boolean
  prompting: boolean
}): boolean {
  if (!input.enabled || input.prompting) return false
  return input.nextState === 'background'
}

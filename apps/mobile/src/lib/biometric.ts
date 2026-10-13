import * as LocalAuthentication from 'expo-local-authentication'

export async function getBiometricAvailability(): Promise<'ready' | 'unavailable'> {
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ])
    return hardware && enrolled ? 'ready' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function promptBiometricUnlock(
  promptMessage: string,
): Promise<'success' | 'cancel' | 'unavailable'> {
  try {
    if ((await getBiometricAvailability()) !== 'ready') return 'unavailable'
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'キャンセル',
      disableDeviceFallback: false,
    })
    if (result.success) return 'success'
    if (
      result.error === 'not_available' ||
      result.error === 'not_enrolled' ||
      result.error === 'passcode_not_set'
    ) {
      return 'unavailable'
    }
    return 'cancel'
  } catch {
    return 'unavailable'
  }
}

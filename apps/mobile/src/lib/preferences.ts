import { createAppPreferences } from '@/shell/preferences'
import { mobileSecureStorage } from '@/lib/secure-storage'

export const appPreferences = createAppPreferences(mobileSecureStorage)

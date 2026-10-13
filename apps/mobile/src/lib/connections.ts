import { createConnectionDirectory } from '@/shell/connections'
import { mobileSecureStorage } from '@/lib/secure-storage'

export const connectionDirectory = createConnectionDirectory(mobileSecureStorage)

import type { SecureStoreLike } from '@line-crm/admin-client'
import * as SecureStore from 'expo-secure-store'

import { browserSecureStorage } from './browser-secure-store'

/** 実機は SecureStore。ブラウザだけ localStorage。 */
export const mobileSecureStorage: SecureStoreLike = browserSecureStorage() ?? SecureStore

import {
  api,
  createSecureStoreCredentialStore,
  fetchApi,
  setAdminCredentialStore,
} from '@line-crm/admin-client'

import { mobileSecureStorage } from './secure-storage'

export const mobileCredentialStore = createSecureStoreCredentialStore(mobileSecureStorage)

setAdminCredentialStore(mobileCredentialStore)

export { api, fetchApi }

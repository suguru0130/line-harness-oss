import {
  api,
  createSecureStoreCredentialStore,
  fetchApi,
  setAdminCredentialStore,
} from '@line-crm/admin-client'
import * as SecureStore from 'expo-secure-store'

export const mobileCredentialStore = createSecureStoreCredentialStore(SecureStore)

setAdminCredentialStore(mobileCredentialStore)

export { api, fetchApi }

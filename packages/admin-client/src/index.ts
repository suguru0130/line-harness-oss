export {
  setAdminCredentialStore,
  fetchApi,
  api,
  bookingApi,
  eventsApi,
} from './client'

export {
  createLocalStorageCredentialStore,
  createSecureStoreCredentialStore,
} from './storage'

export type { KeyValueStorage, SecureStoreLike } from './storage'
export type * from './client'

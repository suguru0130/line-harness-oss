import { setAdminCredentialStore } from '@line-crm/admin-client'
import { webCredentialStore } from './credential-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL
if (!API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Build cannot proceed without a valid API URL. ' +
    'Set it in .env.production (local) or GitHub Secrets (CI).'
  )
}

setAdminCredentialStore(webCredentialStore)

export { webCredentialStore }
export { fetchApi, api, bookingApi, eventsApi } from '@line-crm/admin-client'
export type * from '@line-crm/admin-client'

import type { SecureStoreLike } from '@line-crm/admin-client'

export function memorySecureStore(): SecureStoreLike & { dump(): Record<string, string> } {
  const memory = new Map<string, string>()
  return {
    async getItemAsync(key) {
      return memory.get(key) ?? null
    },
    async setItemAsync(key, value) {
      memory.set(key, value)
    },
    async deleteItemAsync(key) {
      memory.delete(key)
    },
    dump() {
      return Object.fromEntries(memory)
    },
  }
}

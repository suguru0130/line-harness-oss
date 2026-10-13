import { LineHarnessError } from './errors.js'
import type { ApiCredentialSource } from './types.js'

interface HttpClientConfig {
  baseUrl: string
  apiKey: string
  timeout: number
  credentials?: ApiCredentialSource
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeout: number
  private readonly credentials: ApiCredentialSource | undefined

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeout = config.timeout
    this.credentials = config.credentials
  }

  private async resolveAuth(): Promise<{ baseUrl: string; apiKey: string }> {
    if (!this.credentials) {
      return { baseUrl: this.baseUrl, apiKey: this.apiKey }
    }
    const serverUrl = await this.credentials.getServerUrl()
    const apiKey = await this.credentials.getApiKey()
    const baseUrl = (serverUrl ?? this.baseUrl).replace(/\/$/, '')
    if (!baseUrl) {
      throw new LineHarnessError('Server URL is not set', 0, 'credentials')
    }
    return { baseUrl, apiKey: apiKey ?? this.apiKey }
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const auth = await this.resolveAuth()
    const url = `${auth.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.apiKey}`,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }

    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`
      try {
        const errorBody = (await res.json()) as { error?: string }
        if (errorBody.error) errorMessage = errorBody.error
      } catch {
        // ignore parse errors
      }
      throw new LineHarnessError(errorMessage, res.status, `${method} ${path}`)
    }

    return res.json() as Promise<T>
  }
}

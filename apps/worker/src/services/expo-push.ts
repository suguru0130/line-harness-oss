export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_CHUNK_SIZE = 100;
export const EXPO_PUSH_TIMEOUT_MS = 10_000;

const RETRYABLE_EXPO_ERRORS = new Set([
  'HttpError',
  'NetworkError',
  'Timeout',
  'MessageRateExceeded',
  'MissingTicket',
]);

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  data: Record<string, string>;
}

export interface ExpoPushTicketResult {
  token: string;
  ok: boolean;
  errorCode: string | null;
}

export class ExpoPushRequestError extends Error {
  readonly results: ExpoPushTicketResult[];

  constructor(reason: string, results: ExpoPushTicketResult[]) {
    super(`Expo push failed: ${reason}`);
    this.name = 'ExpoPushRequestError';
    this.results = results;
  }
}

export function isRetryableExpoError(errorCode: string | null): boolean {
  return errorCode !== null && RETRYABLE_EXPO_ERRORS.has(errorCode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ticketErrorCode(ticket: unknown): string | null {
  if (!isRecord(ticket)) return 'MissingTicket';
  if (ticket.status === 'ok') return null;
  const details = ticket.details;
  if (isRecord(details) && typeof details.error === 'string') return details.error;
  return 'Unknown';
}

function failedChunk(chunk: ExpoPushMessage[], errorCode: string): ExpoPushTicketResult[] {
  return chunk.map((message) => ({
    token: message.to,
    ok: false,
    errorCode,
  }));
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(timeoutMs);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  options: { accessToken?: string; fetchImpl?: typeof fetch; timeoutMs?: number; chunkSize?: number } = {},
): Promise<ExpoPushTicketResult[]> {
  if (messages.length === 0) return [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? EXPO_PUSH_TIMEOUT_MS;
  const requestedChunkSize = options.chunkSize ?? EXPO_PUSH_CHUNK_SIZE;
  const chunkSize =
    Number.isInteger(requestedChunkSize) && requestedChunkSize > 0
      ? requestedChunkSize
      : EXPO_PUSH_CHUNK_SIZE;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const results: ExpoPushTicketResult[] = [];
  for (let offset = 0; offset < messages.length; offset += chunkSize) {
    const chunk = messages.slice(offset, offset + chunkSize);
    let res: Response;
    try {
      res = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
        signal: timeoutSignal(timeoutMs),
      });
    } catch (err) {
      const errorCode = isTimeoutError(err) ? 'Timeout' : 'NetworkError';
      throw new ExpoPushRequestError(
        errorCode === 'Timeout' ? 'timeout' : 'network',
        [...results, ...failedChunk(chunk, errorCode)],
      );
    }
    if (!res.ok) {
      try {
        await res.body?.cancel();
      } catch {
        // 失敗レスポンスの本文はトークンや通知文を含むことがあるので読まない。
      }
      throw new ExpoPushRequestError(`HTTP ${res.status}`, [
        ...results,
        ...failedChunk(chunk, 'HttpError'),
      ]);
    }
    let payload: { data?: unknown };
    try {
      payload = (await res.json()) as { data?: unknown };
    } catch {
      throw new ExpoPushRequestError('invalid response', [
        ...results,
        ...failedChunk(chunk, 'HttpError'),
      ]);
    }
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    for (let index = 0; index < chunk.length; index += 1) {
      const ticket = tickets[index];
      results.push({
        token: chunk[index]!.to,
        ok: isRecord(ticket) && ticket.status === 'ok',
        errorCode: ticketErrorCode(ticket),
      });
    }
  }
  return results;
}

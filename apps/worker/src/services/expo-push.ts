export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_CHUNK_SIZE = 100;

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

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  options: { accessToken?: string; fetchImpl?: typeof fetch } = {},
): Promise<ExpoPushTicketResult[]> {
  if (messages.length === 0) return [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const results: ExpoPushTicketResult[] = [];
  for (let offset = 0; offset < messages.length; offset += EXPO_PUSH_CHUNK_SIZE) {
    const chunk = messages.slice(offset, offset + EXPO_PUSH_CHUNK_SIZE);
    const res = await fetchImpl(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`Expo push failed: HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { data?: unknown };
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

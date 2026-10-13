import {
  claimUnrepliedAlert,
  deletePushDevicesByTokens,
  getEventBookingPushContext,
  getLatestChatOperatorId,
  getSalonBookingPushContext,
  listPushRecipients,
  listUnrepliedCandidates,
  purgeOldUnrepliedAlerts,
  releaseUnrepliedAlert,
  toJstString,
  type PushRecipientRow,
} from '@line-crm/db';
import {
  STAFF_PUSH_KIND_LABELS,
  STAFF_PUSH_KINDS,
  STAFF_PUSH_SCOPES,
  type StaffNotificationSetting,
  type StaffPushKind,
  type StaffPushPlatform,
  type StaffPushScope,
} from '@line-crm/shared';
import { sendExpoPushMessages, type ExpoPushMessage } from './expo-push.js';

export const DEFAULT_UNREPLIED_MINUTES = 60;
export const MIN_UNREPLIED_MINUTES = 1;
export const MAX_UNREPLIED_MINUTES = 10080;
export const UNREPLIED_GRACE_MS = 24 * 60 * 60 * 1000;
export const UNREPLIED_ALERT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PUSH_BODY_MAX = 140;

const EXPO_TOKEN_PATTERN = /^(Exponent|Expo)PushToken\[[^\s\]]{10,200}\]$/;

export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_PATTERN.test(token);
}

export function parsePushPlatform(value: unknown): StaffPushPlatform | null {
  if (value === undefined || value === null || value === '') return 'unknown';
  if (value === 'ios' || value === 'android' || value === 'unknown') return value;
  return null;
}

export interface ParsedNotificationSetting {
  kind: StaffPushKind;
  enabled: boolean;
  scope: StaffPushScope;
  includeBody: boolean;
  unrepliedMinutes: number | null;
}

export type SettingsParseResult =
  | { ok: true; settings: ParsedNotificationSetting[] }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStaffPushKind(value: string): value is StaffPushKind {
  return (STAFF_PUSH_KINDS as readonly string[]).includes(value);
}

function isStaffPushScope(value: string): value is StaffPushScope {
  return (STAFF_PUSH_SCOPES as readonly string[]).includes(value);
}

export function parseNotificationSettingsBody(body: unknown): SettingsParseResult {
  if (!isRecord(body) || !Array.isArray(body.settings)) {
    return { ok: false, error: 'settings 配列が必要です' };
  }
  if (body.settings.length === 0) {
    return { ok: false, error: 'settings が空です' };
  }

  const settings: ParsedNotificationSetting[] = [];
  const seen = new Set<string>();
  for (const item of body.settings) {
    if (!isRecord(item) || typeof item.kind !== 'string' || !isStaffPushKind(item.kind)) {
      return { ok: false, error: 'kind は new_message, unreplied, booking_request のいずれかです' };
    }
    if (seen.has(item.kind)) {
      return { ok: false, error: 'kind が重複しています' };
    }
    seen.add(item.kind);
    if (typeof item.enabled !== 'boolean') {
      return { ok: false, error: 'enabled は boolean です' };
    }
    if (typeof item.scope !== 'string' || !isStaffPushScope(item.scope)) {
      return { ok: false, error: 'scope は assigned または all です' };
    }
    const includeBody = item.includeBody === undefined ? true : item.includeBody;
    if (typeof includeBody !== 'boolean') {
      return { ok: false, error: 'includeBody は boolean です' };
    }

    let unrepliedMinutes: number | null = null;
    if (item.kind === 'unreplied') {
      if (typeof item.unrepliedMinutes !== 'number' || !Number.isInteger(item.unrepliedMinutes)) {
        return { ok: false, error: '未返信アラートの分数は 1 から 10080 の整数です' };
      }
      if (item.unrepliedMinutes < MIN_UNREPLIED_MINUTES || item.unrepliedMinutes > MAX_UNREPLIED_MINUTES) {
        return { ok: false, error: '未返信アラートの分数は 1 から 10080 の整数です' };
      }
      unrepliedMinutes = item.unrepliedMinutes;
    }

    settings.push({
      kind: item.kind,
      enabled: item.enabled,
      scope: item.scope,
      includeBody,
      unrepliedMinutes,
    });
  }
  return { ok: true, settings };
}

export function viewNotificationSettings(
  rows: Array<{
    kind: string;
    enabled: number;
    scope: string;
    include_body: number;
    unreplied_minutes: number | null;
  }>,
): StaffNotificationSetting[] {
  const byKind = new Map(rows.map((row) => [row.kind, row]));
  return STAFF_PUSH_KINDS.map((kind) => {
    const row = byKind.get(kind);
    const scope: StaffPushScope = row?.scope === 'assigned' ? 'assigned' : 'all';
    return {
      kind,
      label: STAFF_PUSH_KIND_LABELS[kind],
      enabled: row ? row.enabled === 1 : true,
      scope,
      includeBody: row ? row.include_body === 1 : true,
      unrepliedMinutes:
        kind === 'unreplied' ? (row?.unreplied_minutes ?? DEFAULT_UNREPLIED_MINUTES) : null,
    };
  });
}

export function truncatePushText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= PUSH_BODY_MAX) return flat;
  return `${flat.slice(0, PUSH_BODY_MAX - 1)}…`;
}

export function previewFromStoredContent(content: string | null): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return '[メッセージ]';
  return trimmed;
}

function displayNameOrFriend(displayName: string | null): string {
  const name = displayName?.trim();
  return name ? name : '友だち';
}

export function buildNewMessageCopy(input: {
  displayName: string | null;
  preview: string;
  includeBody: boolean;
}): { title: string; body: string } {
  const name = displayNameOrFriend(input.displayName);
  const title = STAFF_PUSH_KIND_LABELS.new_message;
  const preview = input.preview.trim();
  if (!input.includeBody || preview.length === 0) {
    return { title, body: truncatePushText(`${name}さんからメッセージが届きました`) };
  }
  return { title, body: truncatePushText(`${name}: ${preview}`) };
}

export function buildUnrepliedCopy(input: {
  displayName: string | null;
  preview: string;
  includeBody: boolean;
  minutes: number;
}): { title: string; body: string } {
  const name = displayNameOrFriend(input.displayName);
  const title = STAFF_PUSH_KIND_LABELS.unreplied;
  const base = `${name}さんから${input.minutes}分以上返信がありません`;
  const preview = input.preview.trim();
  if (!input.includeBody || preview.length === 0) {
    return { title, body: truncatePushText(base) };
  }
  return { title, body: truncatePushText(`${base}: ${preview}`) };
}

export function formatUtcAsJstLabel(utcIso: string): string | null {
  const ms = new Date(utcIso).getTime();
  if (Number.isNaN(ms)) return null;
  const jst = new Date(ms + 9 * 60 * 60_000).toISOString();
  return `${jst.slice(0, 10)} ${jst.slice(11, 16)}`;
}

export function buildBookingCopy(input: {
  displayName: string | null;
  summaryName: string;
  startsAt: string;
  note: string | null;
  includeBody: boolean;
}): { title: string; body: string } {
  const name = displayNameOrFriend(input.displayName);
  const when = formatUtcAsJstLabel(input.startsAt);
  const summary = [input.summaryName.trim(), when].filter((part) => part && part.length > 0).join(' ');
  const base = summary.length > 0 ? `${name}さんから予約申込: ${summary}` : `${name}さんから予約申込がありました`;
  const note = input.note?.trim() ?? '';
  const body = input.includeBody && note.length > 0 ? `${base} ${note}` : base;
  return { title: STAFF_PUSH_KIND_LABELS.booking_request, body: truncatePushText(body) };
}

interface NotifyOptions {
  expoAccessToken?: string;
  fetchImpl?: typeof fetch;
}

interface ResolvedRecipient {
  staffId: string;
  token: string;
  scope: StaffPushScope;
  includeBody: boolean;
  unrepliedMinutes: number;
}

function resolveRecipients(rows: PushRecipientRow[]): ResolvedRecipient[] {
  const resolved: ResolvedRecipient[] = [];
  for (const row of rows) {
    const minutes = row.unreplied_minutes ?? DEFAULT_UNREPLIED_MINUTES;
    const clamped = Math.min(MAX_UNREPLIED_MINUTES, Math.max(MIN_UNREPLIED_MINUTES, minutes));
    resolved.push({
      staffId: row.staff_id,
      token: row.expo_push_token,
      scope: row.scope === 'assigned' ? 'assigned' : 'all',
      includeBody: row.include_body === 1,
      unrepliedMinutes: Number.isInteger(minutes) ? clamped : DEFAULT_UNREPLIED_MINUTES,
    });
  }
  return resolved;
}

function matchesAssignment(recipient: ResolvedRecipient, operatorId: string | null): boolean {
  if (recipient.scope === 'all') return true;
  return operatorId !== null && operatorId === recipient.staffId;
}

async function dispatchMessages(
  db: D1Database,
  messages: ExpoPushMessage[],
  options: NotifyOptions | undefined,
): Promise<number> {
  if (messages.length === 0) return 0;
  const tickets = await sendExpoPushMessages(messages, {
    accessToken: options?.expoAccessToken,
    fetchImpl: options?.fetchImpl,
  });
  const dead = tickets.filter((ticket) => ticket.errorCode === 'DeviceNotRegistered').map((ticket) => ticket.token);
  if (dead.length > 0) {
    await deletePushDevicesByTokens(db, dead);
  }
  return tickets.filter((ticket) => ticket.ok).length;
}

export async function notifyStaffOfNewMessage(
  db: D1Database,
  input: { friendId: string; displayName: string | null; preview: string },
  options?: NotifyOptions,
): Promise<{ sent: number }> {
  const recipients = resolveRecipients(await listPushRecipients(db, 'new_message'));
  if (recipients.length === 0) return { sent: 0 };
  const operatorId = recipients.some((recipient) => recipient.scope === 'assigned')
    ? await getLatestChatOperatorId(db, input.friendId)
    : null;
  const messages: ExpoPushMessage[] = [];
  for (const recipient of recipients) {
    if (!matchesAssignment(recipient, operatorId)) continue;
    const copy = buildNewMessageCopy({
      displayName: input.displayName,
      preview: input.preview,
      includeBody: recipient.includeBody,
    });
    messages.push({
      to: recipient.token,
      title: copy.title,
      body: copy.body,
      sound: 'default',
      priority: 'high',
      data: { kind: 'new_message', friendId: input.friendId },
    });
  }
  return { sent: await dispatchMessages(db, messages, options) };
}

export async function notifyStaffOfBookingContext(
  db: D1Database,
  input: {
    friendId: string;
    displayName: string | null;
    summaryName: string;
    startsAt: string;
    note: string | null;
    bookingId: string;
    source: 'salon' | 'event';
  },
  options?: NotifyOptions,
): Promise<{ sent: number }> {
  const recipients = resolveRecipients(await listPushRecipients(db, 'booking_request'));
  if (recipients.length === 0) return { sent: 0 };
  const operatorId = recipients.some((recipient) => recipient.scope === 'assigned')
    ? await getLatestChatOperatorId(db, input.friendId)
    : null;
  const messages: ExpoPushMessage[] = [];
  for (const recipient of recipients) {
    if (!matchesAssignment(recipient, operatorId)) continue;
    const copy = buildBookingCopy({
      displayName: input.displayName,
      summaryName: input.summaryName,
      startsAt: input.startsAt,
      note: input.note,
      includeBody: recipient.includeBody,
    });
    messages.push({
      to: recipient.token,
      title: copy.title,
      body: copy.body,
      sound: 'default',
      priority: 'high',
      data: {
        kind: 'booking_request',
        friendId: input.friendId,
        bookingId: input.bookingId,
        source: input.source,
      },
    });
  }
  return { sent: await dispatchMessages(db, messages, options) };
}

async function notifyFromContext(
  db: D1Database,
  bookingId: string,
  source: 'salon' | 'event',
  options: NotifyOptions | undefined,
): Promise<{ sent: number }> {
  const context =
    source === 'salon'
      ? await getSalonBookingPushContext(db, bookingId)
      : await getEventBookingPushContext(db, bookingId);
  if (!context?.friend_id) return { sent: 0 };
  return notifyStaffOfBookingContext(
    db,
    {
      friendId: context.friend_id,
      displayName: context.display_name,
      summaryName: context.summary_name,
      startsAt: context.starts_at,
      note: context.customer_note,
      bookingId,
      source,
    },
    options,
  );
}

export async function notifyStaffOfSalonBooking(
  db: D1Database,
  bookingId: string,
  options?: NotifyOptions,
): Promise<{ sent: number }> {
  return notifyFromContext(db, bookingId, 'salon', options);
}

export async function notifyStaffOfEventBooking(
  db: D1Database,
  bookingId: string,
  options?: NotifyOptions,
): Promise<{ sent: number }> {
  return notifyFromContext(db, bookingId, 'event', options);
}

export async function processUnrepliedPushAlerts(
  db: D1Database,
  input: { now?: Date } & NotifyOptions = {},
): Promise<{ sent: number }> {
  const now = input.now ?? new Date();
  await purgeOldUnrepliedAlerts(db, toJstString(new Date(now.getTime() - UNREPLIED_ALERT_RETENTION_MS)));

  const recipients = resolveRecipients(await listPushRecipients(db, 'unreplied'));
  if (recipients.length === 0) return { sent: 0 };

  const minMinutes = Math.min(...recipients.map((recipient) => recipient.unrepliedMinutes));
  const maxMinutes = Math.max(...recipients.map((recipient) => recipient.unrepliedMinutes));
  const notAfter = toJstString(new Date(now.getTime() - minMinutes * 60_000));
  const notBefore = toJstString(new Date(now.getTime() - (maxMinutes * 60_000 + UNREPLIED_GRACE_MS)));
  const candidates = await listUnrepliedCandidates(db, notAfter, notBefore);

  interface ClaimKey {
    staffId: string;
    friendId: string;
    incomingAt: string;
  }
  const messages: ExpoPushMessage[] = [];
  const claims: ClaimKey[] = [];
  const claimed = new Set<string>();
  const notifiedAt = toJstString(now);

  for (const candidate of candidates) {
    const incomingMs = new Date(candidate.incoming_at).getTime();
    if (Number.isNaN(incomingMs)) continue;
    const ageMs = now.getTime() - incomingMs;
    const preview = previewFromStoredContent(candidate.content);
    for (const recipient of recipients) {
      const thresholdMs = recipient.unrepliedMinutes * 60_000;
      if (ageMs < thresholdMs || ageMs >= thresholdMs + UNREPLIED_GRACE_MS) continue;
      if (!matchesAssignment(recipient, candidate.operator_id)) continue;
      const claimKey = `${recipient.staffId}\0${candidate.friend_id}\0${candidate.incoming_at}`;
      if (!claimed.has(claimKey)) {
        const won = await claimUnrepliedAlert(db, {
          staffId: recipient.staffId,
          friendId: candidate.friend_id,
          incomingAt: candidate.incoming_at,
          notifiedAt,
        });
        if (!won) continue;
        claimed.add(claimKey);
        claims.push({
          staffId: recipient.staffId,
          friendId: candidate.friend_id,
          incomingAt: candidate.incoming_at,
        });
      }
      const copy = buildUnrepliedCopy({
        displayName: candidate.display_name,
        preview,
        includeBody: recipient.includeBody,
        minutes: recipient.unrepliedMinutes,
      });
      messages.push({
        to: recipient.token,
        title: copy.title,
        body: copy.body,
        sound: 'default',
        priority: 'high',
        data: { kind: 'unreplied', friendId: candidate.friend_id },
      });
    }
  }

  try {
    return { sent: await dispatchMessages(db, messages, input) };
  } catch (err) {
    for (const claim of claims) {
      await releaseUnrepliedAlert(db, claim);
    }
    throw err;
  }
}

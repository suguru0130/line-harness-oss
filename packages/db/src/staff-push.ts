import { jstNow } from './utils.js';

export type StaffPushPlatform = 'ios' | 'android' | 'unknown';
export type StaffPushKind = 'new_message' | 'unreplied' | 'booking_request';
export type StaffPushScope = 'assigned' | 'all';

export interface StaffPushDeviceRow {
  id: string;
  staff_id: string;
  expo_push_token: string;
  platform: StaffPushPlatform;
  created_at: string;
  updated_at: string;
}

export interface StaffNotificationSettingRow {
  staff_id: string;
  kind: StaffPushKind;
  enabled: number;
  scope: StaffPushScope;
  unreplied_minutes: number | null;
  include_body: number;
  updated_at: string;
}

export interface PushRecipientRow {
  staff_id: string;
  expo_push_token: string;
  scope: string;
  include_body: number;
  unreplied_minutes: number | null;
}

export interface UnrepliedCandidateRow {
  friend_id: string;
  display_name: string | null;
  incoming_at: string;
  content: string | null;
  operator_id: string | null;
}

export interface BookingPushContextRow {
  friend_id: string;
  display_name: string | null;
  summary_name: string;
  starts_at: string;
  customer_note: string | null;
}

function changesOf(result: { meta?: { changes?: number } }): number {
  return result.meta?.changes ?? 0;
}

export async function upsertStaffPushDevice(
  db: D1Database,
  input: { staffId: string; token: string; platform: StaffPushPlatform },
): Promise<StaffPushDeviceRow> {
  const now = jstNow();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(expo_push_token) DO UPDATE SET
         staff_id = excluded.staff_id,
         platform = excluded.platform,
         updated_at = excluded.updated_at`,
    )
    .bind(id, input.staffId, input.token, input.platform, now, now)
    .run();

  const row = await db
    .prepare(
      `SELECT id, staff_id, expo_push_token, platform, created_at, updated_at
         FROM staff_push_devices
        WHERE expo_push_token = ?`,
    )
    .bind(input.token)
    .first<StaffPushDeviceRow>();
  if (!row) {
    throw new Error('device upsert failed');
  }
  return row;
}

export async function deleteStaffPushDeviceForStaff(
  db: D1Database,
  staffId: string,
  token: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM staff_push_devices WHERE expo_push_token = ? AND staff_id = ?`)
    .bind(token, staffId)
    .run();
  return changesOf(result) > 0;
}

export async function deletePushDevicesByTokens(db: D1Database, tokens: string[]): Promise<void> {
  for (const token of tokens) {
    await db.prepare(`DELETE FROM staff_push_devices WHERE expo_push_token = ?`).bind(token).run();
  }
}

export async function listStaffNotificationSettings(
  db: D1Database,
  staffId: string,
): Promise<StaffNotificationSettingRow[]> {
  const result = await db
    .prepare(
      `SELECT staff_id, kind, enabled, scope, unreplied_minutes, include_body, updated_at
         FROM staff_notification_settings
        WHERE staff_id = ?`,
    )
    .bind(staffId)
    .all<StaffNotificationSettingRow>();
  return result.results ?? [];
}

export async function upsertStaffNotificationSetting(
  db: D1Database,
  input: {
    staffId: string;
    kind: StaffPushKind;
    enabled: boolean;
    scope: StaffPushScope;
    unrepliedMinutes: number | null;
    includeBody: boolean;
  },
): Promise<void> {
  const now = jstNow();
  await db
    .prepare(
      `INSERT INTO staff_notification_settings
         (staff_id, kind, enabled, scope, unreplied_minutes, include_body, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(staff_id, kind) DO UPDATE SET
         enabled = excluded.enabled,
         scope = excluded.scope,
         unreplied_minutes = excluded.unreplied_minutes,
         include_body = excluded.include_body,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.staffId,
      input.kind,
      input.enabled ? 1 : 0,
      input.scope,
      input.unrepliedMinutes,
      input.includeBody ? 1 : 0,
      now,
    )
    .run();
}

export async function listPushRecipients(
  db: D1Database,
  kind: StaffPushKind,
): Promise<PushRecipientRow[]> {
  const result = await db
    .prepare(
      `SELECT d.staff_id AS staff_id,
              d.expo_push_token AS expo_push_token,
              COALESCE(s.scope, 'all') AS scope,
              COALESCE(s.include_body, 1) AS include_body,
              s.unreplied_minutes AS unreplied_minutes
         FROM staff_push_devices d
         LEFT JOIN staff_notification_settings s
           ON s.staff_id = d.staff_id AND s.kind = ?
         LEFT JOIN staff_members m
           ON m.id = d.staff_id
        WHERE COALESCE(s.enabled, 1) = 1
          AND (d.staff_id = 'env-owner' OR m.is_active = 1)
        ORDER BY d.staff_id, d.expo_push_token`,
    )
    .bind(kind)
    .all<PushRecipientRow>();
  return result.results ?? [];
}

export async function getLatestChatOperatorId(
  db: D1Database,
  friendId: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT operator_id
         FROM chats
        WHERE friend_id = ?
        ORDER BY created_at DESC
        LIMIT 1`,
    )
    .bind(friendId)
    .first<{ operator_id: string | null }>();
  return row?.operator_id ?? null;
}

export async function listUnrepliedCandidates(
  db: D1Database,
  notAfter: string,
  notBefore: string,
): Promise<UnrepliedCandidateRow[]> {
  const result = await db
    .prepare(
      `WITH last_incoming AS (
         SELECT friend_id, MAX(created_at) AS at
           FROM messages_log
          WHERE direction = 'incoming'
            AND (source IS NULL OR source != 'postback')
          GROUP BY friend_id
       ),
       last_human AS (
         SELECT friend_id, MAX(created_at) AS at
           FROM messages_log
          WHERE direction = 'outgoing' AND source = 'manual'
          GROUP BY friend_id
       )
       SELECT f.id AS friend_id,
              f.display_name AS display_name,
              li.at AS incoming_at,
              (
                SELECT ml.content
                  FROM messages_log ml
                 WHERE ml.friend_id = f.id
                   AND ml.direction = 'incoming'
                   AND (ml.source IS NULL OR ml.source != 'postback')
                   AND ml.created_at = li.at
                 ORDER BY ml.id ASC
                 LIMIT 1
              ) AS content,
              (
                SELECT c.operator_id
                  FROM chats c
                 WHERE c.friend_id = f.id
                 ORDER BY c.created_at DESC
                 LIMIT 1
              ) AS operator_id
         FROM friends f
         INNER JOIN last_incoming li ON li.friend_id = f.id
         LEFT JOIN last_human lh ON lh.friend_id = f.id
        WHERE f.is_following = 1
          AND (lh.at IS NULL OR lh.at < li.at)
          AND li.at <= ?
          AND li.at >= ?`,
    )
    .bind(notAfter, notBefore)
    .all<UnrepliedCandidateRow>();
  return result.results ?? [];
}

export async function claimUnrepliedAlert(
  db: D1Database,
  input: { staffId: string; friendId: string; incomingAt: string; notifiedAt: string },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO staff_unreplied_alerts
         (staff_id, friend_id, incoming_at, notified_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(input.staffId, input.friendId, input.incomingAt, input.notifiedAt)
    .run();
  return changesOf(result) > 0;
}

export async function releaseUnrepliedAlert(
  db: D1Database,
  input: { staffId: string; friendId: string; incomingAt: string },
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM staff_unreplied_alerts
        WHERE staff_id = ? AND friend_id = ? AND incoming_at = ?`,
    )
    .bind(input.staffId, input.friendId, input.incomingAt)
    .run();
}

export async function purgeOldUnrepliedAlerts(db: D1Database, notifiedBefore: string): Promise<void> {
  await db
    .prepare(`DELETE FROM staff_unreplied_alerts WHERE notified_at < ?`)
    .bind(notifiedBefore)
    .run();
}

export async function deleteStaffPushState(db: D1Database, staffId: string): Promise<void> {
  await db.prepare(`DELETE FROM staff_push_devices WHERE staff_id = ?`).bind(staffId).run();
  await db.prepare(`DELETE FROM staff_notification_settings WHERE staff_id = ?`).bind(staffId).run();
  await db.prepare(`DELETE FROM staff_unreplied_alerts WHERE staff_id = ?`).bind(staffId).run();
}

export async function getSalonBookingPushContext(
  db: D1Database,
  bookingId: string,
): Promise<BookingPushContextRow | null> {
  return db
    .prepare(
      `SELECT b.friend_id AS friend_id,
              f.display_name AS display_name,
              m.name AS summary_name,
              b.starts_at AS starts_at,
              b.customer_note AS customer_note
         FROM bookings b
         INNER JOIN friends f ON f.id = b.friend_id
         INNER JOIN menus m ON m.id = b.menu_id
        WHERE b.id = ?
          AND b.status = 'requested'`,
    )
    .bind(bookingId)
    .first<BookingPushContextRow>();
}

export async function getEventBookingPushContext(
  db: D1Database,
  bookingId: string,
): Promise<BookingPushContextRow | null> {
  return db
    .prepare(
      `SELECT b.friend_id AS friend_id,
              f.display_name AS display_name,
              e.name AS summary_name,
              s.starts_at AS starts_at,
              b.customer_note AS customer_note
         FROM event_bookings b
         INNER JOIN events e ON e.id = b.event_id
         INNER JOIN event_slots s ON s.id = b.slot_id
         INNER JOIN friends f ON f.id = b.friend_id
        WHERE b.id = ?
          AND b.status = 'requested'`,
    )
    .bind(bookingId)
    .first<BookingPushContextRow>();
}

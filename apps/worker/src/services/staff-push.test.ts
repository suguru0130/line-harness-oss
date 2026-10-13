import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const requireFromDb = createRequire(
  fileURLToPath(new URL('../../../../packages/db/package.json', import.meta.url)),
);
const Database = requireFromDb('better-sqlite3') as new (path: string) => BetterSqliteDatabase;
import { Hono } from 'hono';
import { deleteStaffMember, toJstString } from '@line-crm/db';
import type { Env } from '../index.js';
import { staffPush } from '../routes/staff-push.js';
import { EXPO_PUSH_CHUNK_SIZE, EXPO_PUSH_URL, sendExpoPushMessages } from './expo-push.js';
import {
  notifyStaffOfNewMessage,
  notifyStaffOfSalonBooking,
  previewFromStoredContent,
  processUnrepliedPushAlerts,
  UNREPLIED_GRACE_MS,
} from './staff-push.js';

const MIGRATION_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../packages/db/migrations/046_staff_push_notifications.sql'),
  'utf8',
);

const FIXTURE_SQL = `
CREATE TABLE staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE friends (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  is_following INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  friend_id TEXT NOT NULL,
  operator_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE messages_log (
  id TEXT PRIMARY KEY,
  friend_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  content TEXT,
  source TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  friend_id TEXT NOT NULL,
  menu_id TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  customer_note TEXT
);
`;

function asD1(db: BetterSqliteDatabase): D1Database {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const exec = (args: unknown[]) => ({
        async all() {
          return { results: stmt.all(...(args as never[])), success: true, meta: {} };
        },
        async first() {
          return stmt.get(...(args as never[])) ?? null;
        },
        async run() {
          const info = stmt.run(...(args as never[]));
          return { success: true, meta: { changes: info.changes } };
        },
      });
      return { ...exec([]), bind: (...args: unknown[]) => exec(args) };
    },
  } as unknown as D1Database;
}

function openDb(): D1Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(FIXTURE_SQL);
  sqlite.exec(MIGRATION_SQL);
  return asD1(sqlite);
}

const TOKEN_A = 'ExponentPushToken[staffTokenAAAA]';
const TOKEN_B = 'ExponentPushToken[staffTokenBBBB]';
const SECRET_BODY = '秘密の本文です';

function insertStaff(db: D1Database, id: string, isActive = 1): Promise<unknown> {
  return db
    .prepare(
      `INSERT INTO staff_members (id, name, email, role, api_key, is_active, created_at, updated_at)
       VALUES (?, ?, NULL, 'staff', ?, ?, '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
    )
    .bind(id, id, `lh_${id}`, isActive)
    .run();
}

function okFetch(bodies: unknown[]): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body)) as Array<{ to: string; body: string }>;
    bodies.push(parsed);
    return new Response(
      JSON.stringify({ data: parsed.map(() => ({ status: 'ok', id: 'ticket' })) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;
}

describe('push copy', () => {
  test('does not put stored image JSON into the notification body', () => {
    expect(previewFromStoredContent('{"previewUrl":"https://example.test/secret"}')).toBe('[メッセージ]');
    expect(previewFromStoredContent('["https://example.test/secret"]')).toBe('[メッセージ]');
    expect(previewFromStoredContent('[重要] 明日お願いします')).toBe('[重要] 明日お願いします');
    expect(previewFromStoredContent('  こんにちは  ')).toBe('こんにちは');
  });
});

describe('Expo push HTTP', () => {
  test('chunks requests and reads tickets without logging the access token', async () => {
    const seen: Array<{ url: string; auth: string | null; count: number }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const parsed = JSON.parse(String(init?.body)) as unknown[];
      seen.push({ url, auth: headers.get('Authorization'), count: parsed.length });
      return new Response(
        JSON.stringify({ data: parsed.map(() => ({ status: 'ok', id: 't' })) }),
        { status: 200 },
      );
    }) as typeof fetch;

    const messages = Array.from({ length: EXPO_PUSH_CHUNK_SIZE + 1 }, (_, index) => ({
      to: `ExponentPushToken[chunk${index}]`,
      title: '新着メッセージ',
      body: '本文',
      sound: 'default' as const,
      priority: 'high' as const,
      data: { kind: 'new_message', friendId: 'f1' },
    }));
    const tickets = await sendExpoPushMessages(messages, {
      accessToken: 'expo-access-token',
      fetchImpl,
    });
    expect(seen.map((call) => call.url)).toEqual([EXPO_PUSH_URL, EXPO_PUSH_URL]);
    expect(seen.map((call) => call.count)).toEqual([EXPO_PUSH_CHUNK_SIZE, 1]);
    expect(seen[0]?.auth).toBe('Bearer expo-access-token');
    expect(tickets).toHaveLength(EXPO_PUSH_CHUNK_SIZE + 1);
    expect(tickets.every((ticket) => ticket.ok)).toBe(true);
  });

  test('marks DeviceNotRegistered and throws on HTTP failure without the response body', async () => {
    const deadFetch = (async () =>
      new Response(
        JSON.stringify({
          data: [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }],
        }),
        { status: 200 },
      )) as typeof fetch;
    const [ticket] = await sendExpoPushMessages(
      [
        {
          to: TOKEN_A,
          title: 't',
          body: 'b',
          sound: 'default',
          priority: 'high',
          data: { kind: 'new_message' },
        },
      ],
      { fetchImpl: deadFetch },
    );
    expect(ticket?.ok).toBe(false);
    expect(ticket?.errorCode).toBe('DeviceNotRegistered');

    const failing = (async () => new Response('nope', { status: 500 })) as typeof fetch;
    await expect(
      sendExpoPushMessages(
        [
          {
            to: TOKEN_A,
            title: 't',
            body: SECRET_BODY,
            sound: 'default',
            priority: 'high',
            data: {},
          },
        ],
        { fetchImpl: failing },
      ),
    ).rejects.toThrow('HTTP 500');
  });

  test('aborts a hung request without putting the message body in the error', async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing timeout signal'));
          return;
        }
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'TimeoutError';
          reject(err);
        });
      })) as typeof fetch;

    const error = await sendExpoPushMessages(
      [
        {
          to: TOKEN_A,
          title: 't',
          body: SECRET_BODY,
          sound: 'default',
          priority: 'high',
          data: { kind: 'new_message' },
        },
      ],
      { fetchImpl, timeoutMs: 20 },
    ).then(
      () => {
        throw new Error('expected timeout');
      },
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('timeout');
    expect((error as Error).message).not.toContain(SECRET_BODY);
    expect((error as Error).message).not.toContain(TOKEN_A);
  });
});

describe('staff push delivery', () => {
  test('sends the message body only when includeBody is on, and only to the assigned operator', async () => {
    const db = openDb();
    await insertStaff(db, 'owner-1');
    await insertStaff(db, 'staff-assigned');
    await insertStaff(db, 'staff-off', 0);
    await db
      .prepare(
        `INSERT INTO friends (id, display_name, is_following) VALUES ('friend-1', '田中', 1)`,
      )
      .run();
    await db
      .prepare(`INSERT INTO chats (id, friend_id, operator_id, created_at) VALUES ('c1', 'friend-1', 'staff-assigned', '2026-05-01T00:00:00.000+09:00')`)
      .run();

    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d1', 'owner-1', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00'),
                ('d2', 'staff-assigned', ?, 'android', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00'),
                ('d3', 'staff-off', 'ExponentPushToken[inactiveStaff]', 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00'),
                ('d4', 'env-owner', 'ExponentPushToken[envOwnerToken]', 'unknown', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind(TOKEN_A, TOKEN_B)
      .run();
    await db
      .prepare(
        `INSERT INTO staff_notification_settings
           (staff_id, kind, enabled, scope, unreplied_minutes, include_body, updated_at)
         VALUES
           ('owner-1', 'new_message', 1, 'all', NULL, 0, '2026-05-01T00:00:00.000+09:00'),
           ('staff-assigned', 'new_message', 1, 'assigned', NULL, 1, '2026-05-01T00:00:00.000+09:00'),
           ('env-owner', 'new_message', 0, 'all', NULL, 1, '2026-05-01T00:00:00.000+09:00')`,
      )
      .run();

    const bodies: Array<Array<{ to: string; body: string; title: string }>> = [];
    const result = await notifyStaffOfNewMessage(
      db,
      { friendId: 'friend-1', displayName: '田中', preview: SECRET_BODY },
      { fetchImpl: okFetch(bodies) },
    );
    expect(result.sent).toBe(2);
    const sent = bodies.flat();
    const owner = sent.find((message) => message.to === TOKEN_A);
    const assigned = sent.find((message) => message.to === TOKEN_B);
    expect(owner?.title).toBe('新着メッセージ');
    expect(owner?.body).not.toContain(SECRET_BODY);
    expect(assigned?.body).toContain(SECRET_BODY);
    expect(sent.map((message) => message.to)).not.toContain('ExponentPushToken[inactiveStaff]');
    expect(sent.map((message) => message.to)).not.toContain('ExponentPushToken[envOwnerToken]');
  });

  test('drops a token Expo says is no longer registered', async () => {
    const db = openDb();
    await insertStaff(db, 'staff-1');
    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d1', 'staff-1', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind(TOKEN_A)
      .run();
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
        { status: 200 },
      )) as typeof fetch;
    const result = await notifyStaffOfNewMessage(
      db,
      { friendId: 'friend-1', displayName: '田中', preview: 'こんにちは' },
      { fetchImpl },
    );
    expect(result.sent).toBe(0);
    const left = await db
      .prepare(`SELECT COUNT(*) AS c FROM staff_push_devices`)
      .bind()
      .first<{ c: number }>();
    expect(left?.c).toBe(0);
  });

  test('salon booking request includes the note only when includeBody is on', async () => {
    const db = openDb();
    await insertStaff(db, 'staff-1');
    await db
      .prepare(`INSERT INTO friends (id, display_name, is_following) VALUES ('friend-1', '佐藤', 1)`)
      .run();
    await db.prepare(`INSERT INTO menus (id, name) VALUES ('menu-1', 'カット')`).run();
    await db
      .prepare(
        `INSERT INTO bookings (id, friend_id, menu_id, status, starts_at, customer_note)
         VALUES ('booking-1', 'friend-1', 'menu-1', 'requested', '2026-05-10T05:00:00.000Z', ?)`,
      )
      .bind(SECRET_BODY)
      .run();
    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d1', 'staff-1', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind(TOKEN_A)
      .run();
    await db
      .prepare(
        `INSERT INTO staff_notification_settings
           (staff_id, kind, enabled, scope, unreplied_minutes, include_body, updated_at)
         VALUES ('staff-1', 'booking_request', 1, 'all', NULL, 1, '2026-05-01T00:00:00.000+09:00')`,
      )
      .run();

    const bodies: Array<Array<{ body: string; title: string; data: { kind: string; bookingId: string } }>> = [];
    const result = await notifyStaffOfSalonBooking(db, 'booking-1', { fetchImpl: okFetch(bodies) });
    expect(result.sent).toBe(1);
    expect(bodies[0]?.[0]?.title).toBe('予約申込');
    expect(bodies[0]?.[0]?.body).toContain('カット');
    expect(bodies[0]?.[0]?.body).toContain('2026-05-10 14:00');
    expect(bodies[0]?.[0]?.body).toContain(SECRET_BODY);
    expect(bodies[0]?.[0]?.data.kind).toBe('booking_request');
    expect(bodies[0]?.[0]?.data.bookingId).toBe('booking-1');
  });

  test('unreplied cron alerts once inside the window and skips replies, postbacks, and ancient threads', async () => {
    const db = openDb();
    await insertStaff(db, 'staff-1');
    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d1', 'staff-1', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind(TOKEN_A)
      .run();
    await db
      .prepare(
        `INSERT INTO staff_notification_settings
           (staff_id, kind, enabled, scope, unreplied_minutes, include_body, updated_at)
         VALUES ('staff-1', 'unreplied', 1, 'all', 60, 1, '2026-05-01T00:00:00.000+09:00')`,
      )
      .run();

    const now = new Date('2026-05-10T03:00:00.000Z');
    const minutesAgo = (minutes: number) => toJstString(new Date(now.getTime() - minutes * 60_000));
    await db
      .prepare(
        `INSERT INTO friends (id, display_name, is_following) VALUES
           ('due', '田中', 1),
           ('fresh', '早い', 1),
           ('replied', '返信済', 1),
           ('postback-only', 'タップ', 1),
           ('ancient', '昔', 1)`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO messages_log (id, friend_id, direction, content, source, created_at) VALUES
           ('m1', 'due', 'incoming', ?, 'user', ?),
           ('m2', 'fresh', 'incoming', 'まだ早い', 'user', ?),
           ('m3', 'replied', 'incoming', '質問', 'user', ?),
           ('m4', 'replied', 'outgoing', '了解', 'manual', ?),
           ('m5', 'postback-only', 'incoming', 'タップ', 'postback', ?),
           ('m6', 'ancient', 'incoming', '昔の本文', 'user', ?)`,
      )
      .bind(
        SECRET_BODY,
        minutesAgo(90),
        minutesAgo(10),
        minutesAgo(90),
        minutesAgo(30),
        minutesAgo(90),
        minutesAgo(Math.ceil((60 * 60_000 + UNREPLIED_GRACE_MS) / 60_000) + 60),
      )
      .run();

    const bodies: Array<Array<{ body: string }>> = [];
    const first = await processUnrepliedPushAlerts(db, { now, fetchImpl: okFetch(bodies) });
    expect(first.sent).toBe(1);
    expect(bodies.flat().map((message) => message.body).join('\n')).toContain(SECRET_BODY);
    expect(bodies.flat().map((message) => message.body).join('\n')).not.toContain('昔の本文');
    expect(bodies.flat().map((message) => message.body).join('\n')).not.toContain('まだ早い');

    const second = await processUnrepliedPushAlerts(db, { now, fetchImpl: okFetch(bodies) });
    expect(second.sent).toBe(0);
    expect(bodies).toHaveLength(1);
  });

  test('releases the unreplied claim when Expo is down so the next tick can retry', async () => {
    const db = openDb();
    await insertStaff(db, 'staff-1');
    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d1', 'staff-1', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind(TOKEN_A)
      .run();
    const now = new Date('2026-05-10T03:00:00.000Z');
    await db.prepare(`INSERT INTO friends (id, display_name, is_following) VALUES ('due', '田中', 1)`).run();
    await db
      .prepare(
        `INSERT INTO messages_log (id, friend_id, direction, content, source, created_at)
         VALUES ('m1', 'due', 'incoming', 'まだ', 'user', ?)`,
      )
      .bind(toJstString(new Date(now.getTime() - 90 * 60_000)))
      .run();

    const failing = (async () => new Response('down', { status: 503 })) as typeof fetch;
    await expect(processUnrepliedPushAlerts(db, { now, fetchImpl: failing })).rejects.toThrow('HTTP 503');
    const pending = await db
      .prepare(`SELECT COUNT(*) AS c FROM staff_unreplied_alerts`)
      .bind()
      .first<{ c: number }>();
    expect(pending?.c).toBe(0);

    const bodies: unknown[] = [];
    const retried = await processUnrepliedPushAlerts(db, { now, fetchImpl: okFetch(bodies) });
    expect(retried.sent).toBe(1);
  });

  test('keeps claims that Expo already accepted when a later chunk fails', async () => {
    const db = openDb();
    const tokens = ['staff-a', 'staff-b', 'staff-c'].map(
      (id) => `ExponentPushToken[${id}TokenXXXX]`,
    );
    const now = new Date('2026-05-10T03:00:00.000Z');
    await db.prepare(`INSERT INTO friends (id, display_name, is_following) VALUES ('due', '田中', 1)`).run();
    await db
      .prepare(
        `INSERT INTO messages_log (id, friend_id, direction, content, source, created_at)
         VALUES ('m1', 'due', 'incoming', 'まだ', 'user', ?)`,
      )
      .bind(toJstString(new Date(now.getTime() - 90 * 60_000)))
      .run();
    for (const [index, id] of ['staff-a', 'staff-b', 'staff-c'].entries()) {
      await insertStaff(db, id);
      await db
        .prepare(
          `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
           VALUES (?, ?, ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
        )
        .bind(`d-${id}`, id, tokens[index])
        .run();
    }

    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body)) as Array<{ to: string }>;
      if (parsed.some((message) => message.to === tokens[2])) {
        return new Response('down', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          data: parsed.map((message) =>
            message.to === tokens[0]
              ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
              : { status: 'ok', id: 't' },
          ),
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await expect(
      processUnrepliedPushAlerts(db, { now, fetchImpl, chunkSize: 2 }),
    ).rejects.toThrow('HTTP 503');

    const dead = await db
      .prepare(`SELECT COUNT(*) AS c FROM staff_push_devices WHERE expo_push_token = ?`)
      .bind(tokens[0])
      .first<{ c: number }>();
    expect(dead?.c).toBe(0);
    const kept = await db
      .prepare(`SELECT staff_id FROM staff_unreplied_alerts ORDER BY staff_id`)
      .bind()
      .all<{ staff_id: string }>();
    expect(kept.results.map((row) => row.staff_id)).toEqual(['staff-a', 'staff-b']);

    const bodies: Array<Array<{ to: string }>> = [];
    const retried = await processUnrepliedPushAlerts(db, { now, fetchImpl: okFetch(bodies), chunkSize: 2 });
    expect(retried.sent).toBe(1);
    expect(bodies.flat().map((message) => message.to)).toEqual([tokens[2]]);
  });

  test('retries MessageRateExceeded and does not retry a permanent ticket error', async () => {
    const db = openDb();
    await insertStaff(db, 'staff-rate');
    await insertStaff(db, 'staff-big');
    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d-rate', 'staff-rate', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00'),
                ('d-big', 'staff-big', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind('ExponentPushToken[rateTokenXXXX]', 'ExponentPushToken[bigTokenXXXXX]')
      .run();
    const now = new Date('2026-05-10T03:00:00.000Z');
    await db.prepare(`INSERT INTO friends (id, display_name, is_following) VALUES ('due', '田中', 1)`).run();
    await db
      .prepare(
        `INSERT INTO messages_log (id, friend_id, direction, content, source, created_at)
         VALUES ('m1', 'due', 'incoming', 'まだ', 'user', ?)`,
      )
      .bind(toJstString(new Date(now.getTime() - 90 * 60_000)))
      .run();

    const limited = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body)) as Array<{ to: string }>;
      return new Response(
        JSON.stringify({
          data: parsed.map((message) => ({
            status: 'error',
            details: {
              error: message.to.includes('rate') ? 'MessageRateExceeded' : 'MessageTooBig',
            },
          })),
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const first = await processUnrepliedPushAlerts(db, { now, fetchImpl: limited });
    expect(first.sent).toBe(0);
    const pending = await db
      .prepare(`SELECT staff_id FROM staff_unreplied_alerts ORDER BY staff_id`)
      .bind()
      .all<{ staff_id: string }>();
    expect(pending.results.map((row) => row.staff_id)).toEqual(['staff-big']);

    const bodies: Array<Array<{ to: string }>> = [];
    const retried = await processUnrepliedPushAlerts(db, { now, fetchImpl: okFetch(bodies) });
    expect(retried.sent).toBe(1);
    expect(bodies.flat().map((message) => message.to)).toEqual(['ExponentPushToken[rateTokenXXXX]']);
  });

  test('deleting a staff member removes their device and settings', async () => {
    const db = openDb();
    await insertStaff(db, 'staff-1');
    await db
      .prepare(
        `INSERT INTO staff_push_devices (id, staff_id, expo_push_token, platform, created_at, updated_at)
         VALUES ('d1', 'staff-1', ?, 'ios', '2026-05-01T00:00:00.000+09:00', '2026-05-01T00:00:00.000+09:00')`,
      )
      .bind(TOKEN_A)
      .run();
    await db
      .prepare(
        `INSERT INTO staff_notification_settings
           (staff_id, kind, enabled, scope, unreplied_minutes, include_body, updated_at)
         VALUES ('staff-1', 'new_message', 1, 'all', NULL, 1, '2026-05-01T00:00:00.000+09:00')`,
      )
      .run();
    await deleteStaffMember(db, 'staff-1');
    const devices = await db.prepare(`SELECT COUNT(*) AS c FROM staff_push_devices`).bind().first<{ c: number }>();
    const settings = await db
      .prepare(`SELECT COUNT(*) AS c FROM staff_notification_settings`)
      .bind()
      .first<{ c: number }>();
    expect(devices?.c).toBe(0);
    expect(settings?.c).toBe(0);
  });
});

describe('/api/devices and /api/notification-settings', () => {
  function appFor(staff: { id: string; name: string; role: 'owner' | 'admin' | 'staff' } | null, db: D1Database) {
    const app = new Hono<Env>();
    app.use('*', async (c, next) => {
      if (staff) c.set('staff', staff);
      await next();
    });
    app.route('/', staffPush);
    return {
      request: (path: string, init?: RequestInit) => app.request(path, init, { DB: db } as Env['Bindings']),
    };
  }

  test('staff can register and remove only their own token', async () => {
    const db = openDb();
    const alice = appFor({ id: 'alice', name: 'Alice', role: 'staff' }, db);
    const bob = appFor({ id: 'bob', name: 'Bob', role: 'admin' }, db);

    const created = await alice.request('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN_A, platform: 'ios' }),
    });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { success: boolean; data: { staffId: string; platform: string } };
    expect(createdBody.success).toBe(true);
    expect(createdBody.data.staffId).toBe('alice');
    expect(createdBody.data.platform).toBe('ios');

    const stolen = await bob.request('/api/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN_A }),
    });
    expect(stolen.status).toBe(404);

    const moved = await bob.request('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN_A, platform: 'android' }),
    });
    expect(moved.status).toBe(200);
    const movedBody = (await moved.json()) as { data: { staffId: string; platform: string } };
    expect(movedBody.data.staffId).toBe('bob');
    expect(movedBody.data.platform).toBe('android');

    const removed = await bob.request('/api/devices?token=' + encodeURIComponent(TOKEN_A), { method: 'DELETE' });
    expect(removed.status).toBe(200);
    const again = await bob.request('/api/devices?token=' + encodeURIComponent(TOKEN_A), { method: 'DELETE' });
    expect(again.status).toBe(404);
  });

  test('rejects missing auth, bad tokens, and invalid unreplied minutes', async () => {
    const db = openDb();
    const anon = appFor(null, db);
    const staff = appFor({ id: 'staff-1', name: 'Staff', role: 'staff' }, db);

    expect((await anon.request('/api/devices', { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await anon.request('/api/notification-settings')).status).toBe(401);

    const badToken = await staff.request('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'not-a-token' }),
    });
    expect(badToken.status).toBe(400);

    const defaults = await staff.request('/api/notification-settings');
    expect(defaults.status).toBe(200);
    const defaultsBody = (await defaults.json()) as {
      data: { settings: Array<{ kind: string; label: string; enabled: boolean; scope: string; unrepliedMinutes: number | null }> };
    };
    expect(defaultsBody.data.settings.map((setting) => setting.kind)).toEqual([
      'new_message',
      'unreplied',
      'booking_request',
    ]);
    expect(defaultsBody.data.settings.map((setting) => setting.label)).toEqual([
      '新着メッセージ',
      '未返信アラート',
      '予約申込',
    ]);
    expect(defaultsBody.data.settings.every((setting) => setting.enabled && setting.scope === 'all')).toBe(true);
    expect(defaultsBody.data.settings[1]?.unrepliedMinutes).toBe(60);

    const badMinutes = await staff.request('/api/notification-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: [
          { kind: 'unreplied', enabled: true, scope: 'assigned', includeBody: false, unrepliedMinutes: 0 },
        ],
      }),
    });
    expect(badMinutes.status).toBe(400);

    const saved = await staff.request('/api/notification-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: [
          { kind: 'unreplied', enabled: true, scope: 'assigned', includeBody: false, unrepliedMinutes: 15 },
          { kind: 'booking_request', enabled: false, scope: 'all', includeBody: true },
        ],
      }),
    });
    expect(saved.status).toBe(200);
    const savedBody = (await saved.json()) as {
      data: { settings: Array<{ kind: string; enabled: boolean; scope: string; includeBody: boolean; unrepliedMinutes: number | null }> };
    };
    const unreplied = savedBody.data.settings.find((setting) => setting.kind === 'unreplied');
    const booking = savedBody.data.settings.find((setting) => setting.kind === 'booking_request');
    const fresh = savedBody.data.settings.find((setting) => setting.kind === 'new_message');
    expect(unreplied).toMatchObject({ scope: 'assigned', includeBody: false, unrepliedMinutes: 15, enabled: true });
    expect(booking).toMatchObject({ enabled: false, scope: 'all' });
    expect(fresh).toMatchObject({ enabled: true, scope: 'all' });

    const other = appFor({ id: 'other', name: 'Other', role: 'owner' }, db);
    const otherView = (await (await other.request('/api/notification-settings')).json()) as {
      data: { settings: Array<{ kind: string; unrepliedMinutes: number | null }> };
    };
    expect(otherView.data.settings.find((setting) => setting.kind === 'unreplied')?.unrepliedMinutes).toBe(60);
  });
});

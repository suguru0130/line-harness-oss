import { Hono } from 'hono';
import {
  deleteStaffPushDeviceForStaff,
  listStaffNotificationSettings,
  upsertStaffNotificationSetting,
  upsertStaffPushDevice,
} from '@line-crm/db';
import type { StaffPushDevice } from '@line-crm/shared';
import type { Env } from '../index.js';
import {
  isExpoPushToken,
  parseNotificationSettingsBody,
  parsePushPlatform,
  viewNotificationSettings,
} from '../services/staff-push.js';

const staffPush = new Hono<Env>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireStaff(c: { get: (key: 'staff') => Env['Variables']['staff'] | undefined }) {
  const staff = c.get('staff');
  if (!staff) return null;
  return staff;
}

function toDevice(row: {
  id: string;
  staff_id: string;
  expo_push_token: string;
  platform: StaffPushDevice['platform'];
  created_at: string;
  updated_at: string;
}): StaffPushDevice {
  return {
    id: row.id,
    staffId: row.staff_id,
    token: row.expo_push_token,
    platform: row.platform,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /api/devices — ログイン中のスタッフに Expo プッシュトークンを登録する。
// 同じトークンが別スタッフに付いていたら、この端末の利用者として付け替える。
staffPush.post('/api/devices', async (c) => {
  const staff = requireStaff(c);
  if (!staff) return c.json({ success: false, error: 'Unauthorized' }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON が不正です' }, 400);
  }
  if (!isRecord(body) || typeof body.token !== 'string') {
    return c.json({ success: false, error: 'token が必要です' }, 400);
  }
  const token = body.token.trim();
  if (!isExpoPushToken(token)) {
    return c.json({ success: false, error: 'Expo のプッシュトークン形式ではありません' }, 400);
  }
  const platform = parsePushPlatform(body.platform);
  if (!platform) {
    return c.json({ success: false, error: 'platform は ios, android, unknown のいずれかです' }, 400);
  }

  try {
    const row = await upsertStaffPushDevice(c.env.DB, {
      staffId: staff.id,
      token,
      platform,
    });
    return c.json({ success: true, data: toDevice(row) });
  } catch (err) {
    console.error('POST /api/devices error:', err instanceof Error ? err.name : 'error');
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/devices — 自分のトークンだけ外す。他人のトークンは存在を返さない。
staffPush.delete('/api/devices', async (c) => {
  const staff = requireStaff(c);
  if (!staff) return c.json({ success: false, error: 'Unauthorized' }, 401);

  let token = c.req.query('token')?.trim() ?? '';
  if (!token) {
    try {
      const body = await c.req.json();
      if (isRecord(body) && typeof body.token === 'string') token = body.token.trim();
    } catch {
      token = '';
    }
  }
  if (!token) return c.json({ success: false, error: 'token が必要です' }, 400);

  try {
    const removed = await deleteStaffPushDeviceForStaff(c.env.DB, staff.id, token);
    if (!removed) return c.json({ success: false, error: 'デバイスが見つかりません' }, 404);
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/devices error:', err instanceof Error ? err.name : 'error');
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/notification-settings — 自分の通知設定。未保存の種類は初期値を返す。
staffPush.get('/api/notification-settings', async (c) => {
  const staff = requireStaff(c);
  if (!staff) return c.json({ success: false, error: 'Unauthorized' }, 401);
  try {
    const rows = await listStaffNotificationSettings(c.env.DB, staff.id);
    return c.json({ success: true, data: { settings: viewNotificationSettings(rows) } });
  } catch (err) {
    console.error('GET /api/notification-settings error:', err instanceof Error ? err.name : 'error');
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/notification-settings — 自分の設定だけ更新する。送った kind だけ上書きする。
staffPush.put('/api/notification-settings', async (c) => {
  const staff = requireStaff(c);
  if (!staff) return c.json({ success: false, error: 'Unauthorized' }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON が不正です' }, 400);
  }
  const parsed = parseNotificationSettingsBody(body);
  if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400);

  try {
    for (const setting of parsed.settings) {
      await upsertStaffNotificationSetting(c.env.DB, {
        staffId: staff.id,
        kind: setting.kind,
        enabled: setting.enabled,
        scope: setting.scope,
        unrepliedMinutes: setting.unrepliedMinutes,
        includeBody: setting.includeBody,
      });
    }
    const rows = await listStaffNotificationSettings(c.env.DB, staff.id);
    return c.json({ success: true, data: { settings: viewNotificationSettings(rows) } });
  } catch (err) {
    console.error('PUT /api/notification-settings error:', err instanceof Error ? err.name : 'error');
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { staffPush };

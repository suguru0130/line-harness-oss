-- スタッフごとの Expo プッシュトークン、通知設定、未返信アラートの送信済み記録。
-- staff_id は staff_members.id に加え、環境変数 API キーの所有者 'env-owner' も入る。
-- env-owner は staff_members に行が無いので外部キーは張らない。

CREATE TABLE IF NOT EXISTS staff_push_devices (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'unknown' CHECK (platform IN ('ios', 'android', 'unknown')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_staff_push_devices_staff ON staff_push_devices (staff_id);

CREATE TABLE IF NOT EXISTS staff_notification_settings (
  staff_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('new_message', 'unreplied', 'booking_request')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('assigned', 'all')),
  unreplied_minutes INTEGER CHECK (
    unreplied_minutes IS NULL
    OR (unreplied_minutes >= 1 AND unreplied_minutes <= 10080)
  ),
  include_body INTEGER NOT NULL DEFAULT 1 CHECK (include_body IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  PRIMARY KEY (staff_id, kind)
);

CREATE TABLE IF NOT EXISTS staff_unreplied_alerts (
  staff_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  incoming_at TEXT NOT NULL,
  notified_at TEXT NOT NULL,
  PRIMARY KEY (staff_id, friend_id, incoming_at)
);

CREATE INDEX IF NOT EXISTS idx_staff_unreplied_alerts_friend
  ON staff_unreplied_alerts (friend_id, incoming_at);

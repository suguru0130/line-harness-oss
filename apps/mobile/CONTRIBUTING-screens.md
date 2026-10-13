# 画面を足すとき

L-SP の殻（ログイン、タブ、LINEアカウントの切替、設定、共通UI）は、このファイルのルールで機能を足すと、同時に進めてもぶつかりにくいです。

## どのファイルを触るか

タブは 5 つだけです。ホーム、受信箱、友だち、配信、その他。タブは増やしません。

| 機能 | 触ってよい場所 |
| --- | --- |
| ホーム | `src/app/(app)/(tabs)/home/` |
| 受信箱 | `src/app/(app)/(tabs)/inbox/` |
| 友だち | `src/app/(app)/(tabs)/friends/` |
| 配信 | `src/app/(app)/(tabs)/broadcasts/` |
| その他の新しい画面 | `src/app/(app)/(tabs)/more/<名前>.tsx` を新規作成し、`src/navigation/more/<名前>.ts` を足す。`src/navigation/more/index.ts` の配列の末尾に import を 1 行足す |

`index.tsx` は、その機能の一覧画面です。中身を置き換えてよいです。`_layout.tsx` は Stack のままにして、詳細画面は同じフォルダに足します。例: 受信箱の会話は `inbox/[conversationId].tsx`。こうするとタブは増えません。

その他に足す入口は、次の形です。

```ts
export const exampleMoreLink = {
  id: 'example',
  href: '/more/example',
  title: '表示名',
  description: '一行の説明',
  minimumRole: 'admin', // 省略すると全員に出す
}
```

`minimumRole` は `owner` / `admin` / `staff` です。権限が不明な人には、権限が要る入口を出しません。

## 触らないもの

- `apps/worker`。別の人がプッシュ用の API を足しています
- API キーの保存名 `lh_api_key` と、サーバー URL の `lh_server_url`
- 他の機能のフォルダ、ログイン、設定、タブの定義（`src/app/(app)/(tabs)/_layout.tsx`）
- 殻の共通部品の見た目を、機能の都合だけで変えること。足りない部品があれば、その機能の PR で足す前に、既存の部品で足りないか見てください

## 画面から使うもの

- 見た目: `src/components/ui` の `Screen`、`Card`、`List`、`ListRow`、`TextField`、`Button`、`ConfirmDialog`、`LoadingState`、`EmptyState`、`ErrorState`
- ログイン中の情報: `useSession()`。サーバー URL、表示名、権限、保存した接続
- 選択中の LINE アカウント: `useLineAccount()`。`selected.id` を API の `accountId` に渡す
- 権限: `roleAtLeast`、`canManageBroadcasts`、`canManageStaff`、`canEditLineAccounts`、`canAdministerLineAccounts`、または `RoleGate`
- API: `@/lib/api` の `api` と `fetchApi`。鍵は画面で持たず、保存領域からクライアントが読みます

権限の対応は次のとおりです。

- 配信の作成と ON/OFF は admin 以上（`canManageBroadcasts`）
- スタッフの追加と削除は owner だけ（`canManageStaff`）
- LINE アカウントの名前などの編集は admin 以上（`canEditLineAccounts`）
- LINE アカウントの追加、削除、トークン更新は owner だけ（`canAdministerLineAccounts`）

即時配信のように取り消せない操作は、`ConfirmDialog` に `secondTitle` を渡して 2 段階にします。1 段階目で対象人数を見せ、2 段階目で送信します。

## 秘密情報

API キーを画面、ログ、テストの説明、スクリーンショットに出さないでください。サーバー URL は出してよいです。URL にパスワードやクエリを付けないでください。保存は実機では `expo-secure-store`、ブラウザで開いたときだけ同じキー名の localStorage です。

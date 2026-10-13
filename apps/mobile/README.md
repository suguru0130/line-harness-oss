# LINE CRM モバイル

オペレーター向けの iOS / Android アプリの土台です。画面はまだプレースホルダで、中身の機能は別の PR で足します。バックエンドは今の Cloudflare Worker のままです。

## 手元で起動する

リポジトリのルートで:

```bash
pnpm install
pnpm --filter mobile start
```

`start` は共有パッケージをビルドしてから `expo start` します。表示された QR を Expo Go で読むと、プレースホルダのホームが開きます。

型とテストだけ見るとき:

```bash
pnpm --filter @line-crm/shared build
pnpm --filter @line-crm/admin-client build
pnpm --filter @line-harness/sdk build
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile test
```

## いま入っているもの

- Expo SDK 57、Expo Router、TypeScript
- NativeWind（Tailwind のクラス名で見た目を書く）
- サーバー URL と API キーの保存先は `expo-secure-store`。Web 管理画面の `localStorage`（`lh_api_key`）と同じ契約です
- API クライアントは `packages/admin-client`。公式 SDK（`@line-harness/sdk`）も同じ保存先を受け取れます

バンドル ID は仮の `app.linecrm.operator` です。ストアに出す PR で本番の ID に変えます。アイコンもテンプレートのままです。

## EAS（実機プレビュー）

Expo のプロジェクト ID は `813ad40d-1c28-4532-9d5e-bb04b670fe87` です。`app.config.ts` の `extra.eas.projectId` と `updates.url`（`https://u.expo.dev/813ad40d-1c28-4532-9d5e-bb04b670fe87`）に入れてあります。

`owner`（Expo のアカウント名）はリポジトリに書いていません。プロジェクトが非公開で、アカウント名をここから確定できないためです。`EXPO_TOKEN` のアカウントがそのプロジェクトのオーナーなら、そのままで `eas update` できます。Organization のプロジェクトでアカウント不一致と言われたときだけ、GitHub の Actions variable `EXPO_OWNER` に slug を入れてください。アプリ設定は起動時にその変数を `owner` として読みます。

### トークンを GitHub に置く

1. [Expo のアクセストークン](https://expo.dev/settings/access-tokens)を作る
2. GitHub リポジトリの Settings → Secrets and variables → Actions → New repository secret
3. 名前は `EXPO_TOKEN`、値はそのトークン

トークンはチャットや PR に貼らないでください。

### PR のたびに Expo Go で開く

`.github/workflows/mobile-preview.yml` が、PR ごとに `eas update --branch pr-<番号>` を実行し、PR に QR コードと Expo Go 用リンクをコメントします。iPhone でも Android でも、Expo Go からその PR の JS を開けます。

`EXPO_TOKEN` が無いときは配信せず、理由を PR にコメントして終了します。このときワークフローは失敗にしません。トークンを足したあとに、そのワークフローを再実行してください。

プロジェクトを結び直す必要が出たときだけ、`apps/mobile` で `eas init` を実行します。ID はすでに入っているので、通常の開発では不要です。`slug` は Expo 側の `line-sp-project` に合わせています。

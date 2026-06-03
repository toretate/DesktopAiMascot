# タスクリスト: 将来的なマルチユーザー対応のための認証の仕組み（UI・BFF Cookie対応編）

- [x] 1. サーバー側のハイブリッド認証およびBFFログイン機能の実装
    - [x] `server/src/middlewares/auth-middleware.ts` の修正（Cookie手動パースとヘッダー/Cookie両対応）
    - [x] `server/src/routes/auth.ts` の新規作成（Googleログイン、コールバック、ステータス確認API）
    - [x] `server/src/index.ts` への認証ルートのマウント
    - [x] `server/src/routes/websocket.ts` の接続時認証（Cookieパース対応）への改修
- [x] 2. クライアント側（Electron Main / Preload）のログイン連携実装
    - [x] `ui/electron/main.ts` でログイン開始用IPCハンドラ (`auth:login`) を実装
    - [x] `ui/electron/preload.ts` から認証APIのブリッジを露出
- [x] 3. クライアント側（Vue.js / Pinia）の認証・通信実装
    - [x] 認証ストア `ui/src/stores/auth.ts` の新規作成
    - [x] API通信時（configのGET/POSTなど）に `credentials: 'include'` を付与
    - [x] ログイン状態を表示・操作するUIコンポーネント（設定画面等）の追加
- [x] 4. 動作検証とWalkthroughの更新
    - [x] サーバーおよびクライアントのビルド確認
    - [x] ログイン動作、Cookieによるセッション維持、WebSocket通信の疎通確認

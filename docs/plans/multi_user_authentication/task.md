# タスクリスト: 将来的なマルチユーザー対応のための認証の仕組みの実装

- [x] 1. 認証関連サービスの実装 (`server/src/services/auth-service.ts`)
    - [x] Google JWKS (公開鍵) の取得・キャッシュロジックの実装
    - [x] JWT デコードおよび `kid` に基づく公開鍵署名検証の実装
    - [x] クレーム検証 (`iss`, `aud`, `exp`, `email_verified` 等)
- [x] 2. ユーザー管理ファイルと認証ミドルウェアの実装
    - [x] 許可ユーザー設定ファイル (`server/users.json`) の作成
    - [x] 認証ミドルウェア (`server/src/middlewares/auth-middleware.ts`) の実装
        - [x] トークンの検証結果から `sub`, `email` を取得
        - [x] `users.json` のスキャン
        - [x] 初回ログイン時の `sub` 自動紐付け・ファイル保存処理
- [x] 3. 既存 API への適用
    - [x] `server/src/routes/config.ts` への認証ミドルウェアの適用
- [x] 4. WebSocket 接続への適用
    - [x] `server/src/routes/websocket.ts` でのトークン検証ロジックの追加
- [x] 5. 検証と動作確認
    - [x] サーバービルドの実行 (`npm run build`)
    - [x] テスト用トークン等を用いた動作検証


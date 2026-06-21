# タスクリスト：マルチユーザーマスコット管理の実装

本タスクリストは、デスクトップAIマスコットのマルチユーザー対応（内部ユーザーID仲介による、ユーザーごとの設定・履歴・アセットの分離）を行うための作業項目を管理します。

## フェーズ 1: ユーザー管理層の拡張設計と共通ユーティリティの実装
- [ ] `server/users.json` のデータ構造の拡張定義（内部ユーザーIDと外部認証情報の紐付け）
- [ ] 内部ユーザーIDを検索・生成・管理するヘルパー関数の実装
- [ ] 認証ミドルウェア（`authMiddleware` および `authenticateUserToken`）の修正
    - [ ] 認証成功時に外部の `sub` (Google ID) から内部の `userId` (`usr_...`) を引き当て、`req.user.id` にセットする処理の実装
    - [ ] 新規ユーザーログイン時に内部の `userId` を新規自動生成し、`users.json` に保存する処理の実装
    - [ ] ローカル開発時のバイパス動作で、固定の内部ユーザーID `usr_local_dev_bypass` を設定する処理の実装

## フェーズ 2: サーバー側 API の修正（内部ユーザーIDの使用）
- [ ] `server/src/routes/config.ts` の修正
    - [ ] ログインユーザー（`req.user.id`）ごとの `config.json` のロード処理の実装
    - [ ] ログインユーザーごとの `config.json` のセーブ処理の実装
    - [ ] アセット保存関数 `saveBase64Image` に `internalUserId` を引き渡し、`mascots/users/<internal_user_id>/...` に分離して保存するよう修正
- [ ] `server/src/routes/history.ts` の修正
    - [ ] ログインユーザー（`req.user.id`）ごとの `chat_history.json` のロード処理の実装
    - [ ] ログインユーザーごとの `chat_history.json` のセーブ処理の実装

## フェーズ 3: WebSocket 音声ログ保存処理の修正
- [ ] `server/src/routes/websocket.ts` の修正
    - [ ] 合成音声の保存パスに `users/<internal_user_id>/` を挿入し、ユーザーごとに隔離して保存するよう修正

## フェーズ 4: 動作確認とテスト
- [ ] ローカル開発時の動作確認（自動バイパスにより `usr_local_dev_bypass` として設定が読み書きされること）
- [ ] 異なるユーザーIDを持つリクエストをシミュレートし、それぞれ別の内部ユーザーIDディレクトリに設定や履歴が書き込まれることの確認
- [ ] ユーザーごとの画像アセットが正しく保存され、対応するパス（`/mascots/users/<internal_user_id>/...`）経由でクライアントから表示可能であることの確認

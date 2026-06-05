# LM Studio コネクタ移行タスク

- [x] `server/src/connector/lmstudio-connector.ts` の新規作成とロジックの移植
- [x] `server/src/services/chat-ai-service.ts` のリファクタリング (Connectorの呼び出しへの差し替え、不要ロジックの削除)
- [x] サーバープロジェクトのビルド検証 (`npm run build`)

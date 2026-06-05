# UI側 LM Studio コネクタ移行タスク

- [x] `ui/src/connector/lmstudio-connector.ts` の新規作成とロジックの移植
- [x] `ui/electron/main.ts` のリファクタリング (Connectorの呼び出しへの差し替え、不要ロジック・インポートの削除)
- [x] UIプロジェクトのビルド検証 (`npm run build`)

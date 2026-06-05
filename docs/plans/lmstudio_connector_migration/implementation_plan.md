# LM Studio コネクタ移行実装計画

サーバー側の LM Studio 関連コードを `server/src/connector/lmstudio-connector.ts` に移動し、関心の分離（Separation of Concerns）とコードの再利用性を高めます。

## ユーザー確認事項

> [!NOTE]
> この変更はリファクタリング（コードの移動と整理）であり、API の動作やマスコット機能の挙動自体に変更はありません。

## 予定される変更点

### 1. LM Studio コネクタの新規作成
#### [NEW] [lmstudio-connector.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/connector/lmstudio-connector.ts)
* `LMStudioClient` を使用した推論処理、WebSocket 接続形式への変換ロジック、思考プロセス（Thinking Process）のクレンジング処理をこのファイルにカプセル化します。

### 2. チャットAIサービスの修正
#### [MODIFY] [chat-ai-service.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/services/chat-ai-service.ts)
* `LMStudioClient` の直接インポートや WebSocket 変換ヘルパーを削除し、新しく作成した `LmStudioConnector.generateResponse` を呼び出す形にリファクタリングします。

## 検証計画

### コンパイルチェック
* サーバー側が正常にビルドできることを検証します。
  ```bash
  cd server
  npm run build
  ```

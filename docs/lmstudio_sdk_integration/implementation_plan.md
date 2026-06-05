# LM Studio SDK 移行実装計画

LM Studio との連携処理（モデル一覧取得およびチャット対話）を、公式の `@lmstudio/sdk` を用いた実装に移行します。これにより、LM Studio 特有 of 機能判定（`vision` や `reasoning` など）をより堅牢かつ公式サポートされた方法で取得・活用できるようになります。

## ユーザー確認事項

> [!NOTE]
> LM Studio SDK は WebSocket 経由で通信を行うため、設定画面に入力されている HTTP エンドポイント（例: `http://localhost:1234/v1/`）を自動的に WebSocket 形式（例: `ws://localhost:1234`）へ変換して接続を行います。ユーザー側での設定値の変更は不要です。

## 予定される変更点

### 1. 依存関係の追加
#### [MODIFY] [ui/package.json](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/package.json)
#### [MODIFY] [server/package.json](file:///c:/workspace/workspace-win/DesktopAiMascot/server/package.json)
* `dependencies` に `@lmstudio/sdk` を追加します。

---

### 2. メインプロセス (Electron)
#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
* `LMStudioClient` をインポートし、入力された HTTP エンドポイントを WebSocket 形式（`ws://...`）に変換するユーティリティを導入します。
* `get-lmstudio-models` ハンドラーを、`client.llm.listLoaded()` を用いて現在ロードされているモデルを取得するロジックに変更します。取得したモデルの `capabilities` から `vision` などの情報を正確にマッピングします。
* `ask-lmstudio` ハンドラーを、`client.llm.get({ id: modelName })` でモデルを取得し、`model.respond(messages)` でチャット推論を実行するロジックに変更します。

---

### 3. バックエンドサーバー (Server)
#### [MODIFY] [chat-ai-service.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/services/chat-ai-service.ts)
* WebSocket接続経由での対話処理において、`ChatAiService.generateResponse` の `lmstudio` エンジン部分を、`LMStudioClient` を用いた対話処理に書き換えます。

---

## 検証計画

### 開発用ビルドとコンパイルチェック
- フロントエンドおよびメインプロセスが正常にビルドできることを検証します。
  ```bash
  cd ui
  npm run build
  ```
- バックエンドサーバーが正常にビルドできることを検証します。
  ```bash
  cd server
  npm run build
  ```

### 手動検証
- 設定画面から LM Studio の疎通確認を実行し、現在ロードされているモデル一覧が正常に取得できること。
- ロードされたモデルの横に `Vision`（👁️）や `Thought`（💡）アイコンが正確に表示されること。
- チャット画面から LM Studio 経由でのメッセージ送受信、および画像解析が正常に動作すること。

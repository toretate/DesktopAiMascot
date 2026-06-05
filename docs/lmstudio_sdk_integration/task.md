# LM Studio SDK 移行タスク

- [x] `@lmstudio/sdk` のインストール
    - [x] `ui` ディレクトリでのパッケージ追加
    - [x] `server` ディレクトリでのパッケージ追加
- [x] メインプロセス (`ui/electron/main.ts`) の修正
    - [x] HTTPエンドポイントをWebSocketに変換するヘルパーの実装
    - [x] `get-lmstudio-models` ハンドラーの `LMStudioClient` への移行
    - [x] `ask-lmstudio` ハンドラーの `LMStudioClient` への移行
- [x] サーバー側対話サービス (`server/src/services/chat-ai-service.ts`) の修正
    - [x] `lmstudio` チャット推論ロジックの `LMStudioClient` への移行
- [x] ビルド検証
    - [x] `ui` ディレクトリでのビルド確認
    - [x] `server` ディレクトリでのビルド確認
- [ ] 動作確認・手動検証
    - [ ] 設定画面でのモデル一覧読み込み検証
    - [ ] チャット画面でのLM Studio経由対話検証

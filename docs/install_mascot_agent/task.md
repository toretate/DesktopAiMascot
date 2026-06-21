# タスク管理: Vercel AI SDK の導入と AI エージェント化

## 概要
デスクトップマスコットシステムにおいて、ローカルLLM（LM Studio）とリモートLLM（Gemini）の切り替え、ツール実行ループ、ストリーミング応答を簡潔かつ堅牢に管理するため、エージェントフレームワークとして **Vercel AI SDK** を導入し、関連するサービスやツールをリファクタリングします。

## タスクリスト

- [x] Git ブランチ `feature/install-mascot-agent` の作成と切り替え
- [x] 計画ドキュメントの作成
    - [x] `task.md` の作成
    - [x] `implementation_plan.md` の作成
- [x] `server` プロジェクトへのパッケージインストール
    - [x] `ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `zod` のインストール
- [x] ツールアダプターの作成
    - [x] `@lmstudio/sdk` 形式のツールを Vercel AI SDK の `tools` 形式に変換するアダプターの実装
- [x] `ChatAiService` のリファクタリング
    - [x] `ChatAiService.ts` を Vercel AI SDK の `generateText` に移行
    - [x] Gemini API 直接コールおよび自前ループの廃止
    - [x] LM Studio (OpenAI互換) プロバイダーとの統合
- [x] 動作検証とテスト
    - [x] サーバーのビルド・起動確認
    - [x] 既存のテストコードの実行と調整
- [x] Walkthrough の作成
    - [x] `walkthrough.md` の作成

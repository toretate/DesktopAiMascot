# 修正内容の確認 (Walkthrough)

Vercel AI SDK を導入し、従来の Gemini API 直接コールおよび自律ツールループをリファクタリングしました。

## 1. 変更点の概要

1.  **依存関係の追加**:
    *   `server/package.json` に `@ai-sdk/google`, `@ai-sdk/openai`, `ai`, `zod` を追加し、インストールしました。
2.  **ツールアダプター (`tool-adapter.ts`) の新規作成**:
    *   既存の `@lmstudio/sdk` の `tool` 定義を、Vercel AI SDK の `tools` オプションが要求するオブジェクトおよび Zod スキーマ形式に動的に変換するアダプター `convertLmStudioToolToVercel` を実装しました。
3.  **`ChatAiService` のリファクタリング**:
    *   [chat-ai-service.ts](file:///C:/workspace/workspace-win/DesktopAiMascot/server/src/services/chat-ai-service.ts) を全面的に書き換えました。
    *   自作の `while` ループによるツール判定と呼び出し、Gemini に対する生 Fetch リクエストを廃止し、Vercel AI SDK の `generateText` に移行しました。
    *   `messages` には SDK 最新仕様（v6.0.208）に対応する `ModelMessage[]` 型を使用。
    *   自律ループ制御には、新設された `stopWhen` オプションに `[isLoopFinished(), stepCountIs(5)]` を指定し、LLM が最終的な結論を出すまで自動実行ループを回す設計にしました。
    *   LM Studio (ローカル) 選択時には `createOpenAI` から生成したプロバイダーを使用し、Gemini 選択時には `createGoogleGenerativeAI` 経由で接続します。
    *   思考プロセスタグ（`<think>`, `<thought>`）や繰り返しリピート問題などのトリミングロジックはリファクタリング後も維持しています。

## 2. 検証結果

*   **コンパイル検証**: `npm run build` を実行し、TypeScript のコンパイルエラーが無いことを確認しました。
*   **テストスイート検証**: `npm run test` を実行し、認証や背景除去などの既存テストケース（14件）がすべて正常にパスすることを確認しました。

## 3. 重要課題の解決 (Bad Request 接続エラーの修正)

Vercel AI SDK 6.x への移行時、LM Studio (ローカルエンジン) との通信で発生していた `400 Bad Request (invalid_union_discriminator. Expected 'object')` のエラーの原因を特定し、修正しました。

1.  **ツールのキー名仕様変更 (`inputSchema`)**:
    Vercel AI SDK 6.x の内部 (共通処理および `@ai-sdk/openai` 等のプロバイダー) では、ツールのパラメータスキーマのキーとして `parameters` ではなく **`inputSchema`** が参照されていることが判明しました。従来のプレーンオブジェクト形式で `parameters` のみを指定していたためスキーマ全体が無視され、API リクエスト時に空の `{ properties: {}, additionalProperties: false }` にリセットされていました。
2.  **Zod バージョン非互換・二重ロードバグの解消**:
    `@lmstudio/sdk` が内部で持つ Zod v3 インスタンスを Zod v4 (プロジェクトの `zod` および Vercel AI SDK の期待バージョン) にそのまま、または単純に `zodSchema` などでラップして渡すと、内部プロトタイプの差異によりパラメータ定義内のプロパティが一切抽出できず、同様に空の `{}` となっていました。
3.  **カスタムスキーマ抽出器の導入**:
    [tool-adapter.ts](file:///C:/workspace/workspace-win/DesktopAiMascot/server/src/utils/tool-adapter.ts) に `convertLmStudioSchemaToPlainJsonSchema` ヘルパーを新設。LM Studio の `parametersSchema` から Zod v3/v4 のインスタンス競合を回避しつつプレーンな JSON Schema を動的に抽出・再構築し、それを Vercel AI SDK の `jsonSchema()` ヘルパーでラップして、`inputSchema` と `parameters` の両キーに割り当てることで、完全に互換性のある有効な JSON Schema シリアライズを保証しました。


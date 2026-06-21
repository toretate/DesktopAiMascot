# 実装計画: Vercel AI SDK の導入と AI エージェント化

## 1. 目的
現在の自律ループによるツール呼び出し（Tool Calling）および LLM API の直接コールを、**Vercel AI SDK** を用いた実装へリファクタリングします。これにより、Gemini API と LM Studio（ローカルモデル）の切り替えを容易にし、ストリーミング応答や自律ループの信頼性を向上させます。

## 2. 移行アプローチ

### 2.1. 必要なパッケージのインストール
`server` ディレクトリにて、以下のパッケージを追加します。
- `ai`: Vercel AI SDK コアライブラリ
- `@ai-sdk/google`: Gemini プロバイダー
- `@ai-sdk/openai`: LM Studio（OpenAI 互換エンドポイントとして接続）用プロバイダー
- `zod`: ツール引数のスキーマ定義およびバリデーション用

### 2.2. LM Studio ツールから Vercel AI SDK ツールへの変換アダプター
現在、各ツールは `@lmstudio/sdk` の `tool` 関数で作成されています。
```typescript
// 例: current-time-tool.ts
export const currentTimeTool = tool({
    name: 'getCurrentTime',
    description: '現在のシステム時刻（日付と時間）を取得します。',
    parameters: {},
    implementation: () => { ... }
});
```
Vercel AI SDK は、各ツールを `{ description, parameters, execute }` を持つオブジェクトとして定義します。また、`parameters` には `zod` スキーマを渡す必要があります。

既存のツールファイルをすべて書き換えるのを避けるため、既存の `LM Studio tool` オブジェクトを Vercel AI SDK 互換のツール定義オブジェクトに動的に変換するアダプター関数 `convertLmStudioToolToVercel(lmTool: any)` を導入します。

#### アダプターの設計方針 (`server/src/utils/tool-adapter.ts`):
- `lmTool.parameters` の JSON スキーマのような構造を `zod` スキーマに簡易マッピングします（現在は引数なし、もしくは単純なプリミティブのみなので、手動または簡易マッパーで対応します）。
- ツールが引数を持つ場合（例: `latitude`, `longitude`, `volume`, `appName`, `query`）、Zodスキーマを構築して割り当てます。
- `execute` 関数の中で `lmTool.implementation` を呼び出します。

### 2.3. `ChatAiService` のリファクタリング (`server/src/services/chat-ai-service.ts`)
- 自前の `while` ループによるツール実行フロー（`loopCount < maxLoops`）を廃止し、`generateText` または `streamText` に `maxSteps: 5` を渡して SDK 側に実行を委ねます。
- 履歴 (history) を Vercel AI SDK の `CoreMessage` 形式 (`{ role: 'user' | 'assistant', content: string }` 等) にマッピングします。
- `engine === 'lmstudio'` の場合は、`createOpenAI` から作成したカスタムプロバイダーを使用し、そうでない場合は `google('gemini-1.5-flash')` 等を使用します。

## 3. 変更ファイルと影響範囲
- `server/package.json`: 依存関係の追加
- `server/src/services/chat-ai-service.ts`: LLM対話ロジックの全面リファクタリング
- `server/src/utils/tool-adapter.ts` (新規): ツール形式の変換アダプター

## 4. 検証計画
- `server` のビルド確認 (`npm run build`)
- 開発サーバーの起動確認 (`npm run dev`)
- 既存のテストコード (`server/src/test/` 内など) が正常に動作するか確認

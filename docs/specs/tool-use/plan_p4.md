# P4 実装計画: ツールアダプタの型付け（`any` の排除）

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 基準コミット | `0e5f185` |
| 前提文書 | `walkthrough_p4.md`（型情報は全て検証済み。再調査不要） |
| 作業指示 | `fix_instructions_p4.md` |

## ゴールと非ゴール

**ゴール**: Vercel 経路のツール変換を、`any` を使わない構造的な型で書き直す。実行時挙動は完全不変。

**非ゴール（明示的にやらない）**:
- zod スキーマから `execute` 引数への**ジェネリックな型推論**。スキーマは実行時データ（`parametersSchema`）であり、静的推論はレジストリ設計の全面変更なしには不可能。`input: unknown` が正直かつ正しい型。
- `llm.act` 経路・レジストリ・プロンプトの変更。
- `response` オブジェクト全体の厳密型付け（`GenerateTextResult` のジェネリクスはモック互換性を壊しやすい。D6 の範囲に留める）。

## 設計判断

### D1. アダプタの入力型 — SDK の `Tool` を受け、`FunctionTool` に型ガードで絞る

```typescript
import type { Tool as LMTool, FunctionTool, ToolCallContext } from '@lmstudio/sdk';

export function convertLmStudioToolToVercel(
    lmTool: LMTool,
    onExecute?: (input: unknown, output: unknown) => void,
    onInterceptExecute?: (input: unknown) => Promise<unknown>
) {
    if (lmTool.type !== 'function') {
        throw new Error(`[tool-adapter] Unsupported tool type "${lmTool.type}" for "${lmTool.name}". Only FunctionTool is supported.`);
    }
    // 以降 lmTool は FunctionTool に narrow される
```

`tool()` の戻り値は union の `Tool` なので、呼び出し側（`mascotTools`）を変えずに済むのはこの形だけ。7ツール全てが FunctionTool なので throw は実際には発生しない（防御的ガード）。

### D2. アダプタの出力 — `ai` の `dynamicTool()` を使う

手書きオブジェクト `{ description, inputSchema, execute }` をやめ、`ai` が export する `dynamicTool()`（実行時定義ツール用の公式プリミティブ）に置き換える。戻り値が `ToolSet` に適合する型付きツールになる。

```typescript
import { dynamicTool } from 'ai';

    return dynamicTool({
        description: lmTool.description || '',
        inputSchema: lmTool.parametersSchema,   // 型が合わなければ D5
        execute: async (input, { abortSignal }) => { /* 現行ロジックを逐語移植 */ },
    });
```

### D3. `ToolCallContext` の正しいスタブ

現行の `{ abortSignal }` は型を満たさない（walkthrough §2）。以下のスタブに置き換える。**実行時挙動の差はない**（本リポジトリの全ツール実装は ctx を読まないことを確認済み）:

```typescript
const ctx: ToolCallContext = {
    status: () => {},
    warn: (text) => console.warn(`[Tool Warning] ${lmTool.name}: ${text}`),
    signal: abortSignal ?? new AbortController().signal,
    callId: 0,
};
const toolResponse = await lmTool.implementation(input as Record<string, unknown>, ctx);
```

- `input as Record<string, unknown>`: dynamicTool の input は `unknown`。inputSchema（zod）で検証済みの値が来るため、この assertion は安全かつ最小。
- `warn` を console.warn に繋ぐのは可（ログ追加は挙動変更に含めない）。`status` は noop。

### D4. 呼び出し側（`chat-ai-service.ts`）の型

```typescript
import { generateText, ModelMessage, stepCountIs, ToolSet } from 'ai';

const vercelTools: ToolSet = {};
const executedTools: Array<{ toolName: string; input: unknown; output: unknown }> = [];
```

- `onToolResult` / `onToolExecute` の params 型（現状 `any`）はシグネチャ互換のため**変更しない**（呼び出し元 ws.ts への波及を防ぐ）。
- `generateOptions` の型付けは**任意扱い**: `delete retryOptions.tools` パターンと条件付き代入があるため、`Parameters<typeof generateText>[0]` を試みて型エラーと格闘し始めたら **`any` のまま残してよい**（`fix_instructions_p4.md` T3 のフォールバック規定）。P4 の本丸はアダプタであり、ここで時間を溶かさない。

### D5. zod スキーマの受け渡し

ルート zod は 3.25.76 の単一インスタンス（walkthrough §2）。`parametersSchema: ZodSchema` を `inputSchema` に直接渡して型が通るはず。通らない場合**のみ** `ai` の `zodSchema()` でラップする:

```typescript
import { zodSchema } from 'ai';
inputSchema: zodSchema(lmTool.parametersSchema),
```

どちらを採ったか報告に明記すること。

### D6. 結果パースの型

```typescript
if (typeof toolResponse === 'string') {
    try {
        return JSON.parse(toolResponse) as unknown;
    } catch {
        return { result: toolResponse };
    }
}
return toolResponse as unknown;
```

ロジックは現行と逐語一致（walkthrough §3 の 5 ステップ順序を崩さない）。

## リスクと対策

| リスク | 対策 |
| --- | --- |
| `dynamicTool` の execute options 型が現行の `{ abortSignal }: { abortSignal?: AbortSignal } = {}` と異なる | dynamicTool では options が常に渡るためデフォルト引数は不要になる。分割代入 `{ abortSignal }` のみ受ければよい |
| `inputSchema` の型不整合（zod3 vs FlexibleSchema） | D5 のフォールバック。**`as any` での強制キャストは禁止**（それでは P4 の意味がない） |
| `generateOptions` 型付けの泥沼 | D4 のフォールバック規定（`any` 残置可、報告必須） |
| 既存テストへの波及 | `generateText` はモックのため原則波及なし。壊れた場合は実装を疑う（期待値書き換え禁止） |
| `JSON.parse` 戻り値の `any` 汚染 | `as unknown` を明示（D6） |

## 完了の定義

- `tool-adapter.ts` から `any` が消える（`as any` への置き換えも不可）
- `vercelTools` が `ToolSet`、`executedTools` が `unknown` ベースの型になる
- 既存27テスト無修正で成功＋アダプタ単体テスト新設（`fix_instructions_p4.md` T4）
- `npx tsc --noEmit` で新規エラーゼロ（着手前ベースライン比）

# P4 ウォークスルー: ツールアダプタの型消失の現状

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 基準コミット | `0e5f185`（P3 完了後） |
| 作業者 | Gemini（レビューは別途） |
| 目的 | レビュー項目A「`@lmstudio/sdk` → Vercel 変換の型消失」解消の前提知識 |
| 関連文書 | `plan_p4.md`（設計）、`fix_instructions_p4.md`（作業指示） |

---

## 1. 問題の所在

ツールは `@lmstudio/sdk` の `tool()` で定義され、(1) connector の `llm.act` にはそのまま、(2) ChatAiService の Vercel 経路には `convertLmStudioToolToVercel()` で変換して渡される。**変換アダプタとその周辺が全て `any`** であり、型検査が効いていない:

- `src/server/utils/tool-adapter.ts`: `convertLmStudioToolToVercel(lmTool: any, onExecute?, onInterceptExecute?): any`
- `src/server/utils/chat-ai-service.ts`: `vercelTools: Record<string, any>`、`generateOptions: any`、`executedTools` の `input/output: any`

P4 のスコープは **Vercel 経路の型付けのみ**。`llm.act` 経路・レジストリ（`mascotTools`）・プロンプトは触らない。

## 2. 検証済みの型情報（この節の事実は再調査不要。信頼してよい）

### `@lmstudio/sdk` v1.5.0（`node_modules/.../dist/index.d.ts` で確認済み）

```typescript
export type Tool = FunctionTool | RawFunctionTool | UnimplementedRawFunctionTool | RemoteTool;

export interface ToolBase { name: string; description: string; }

export interface FunctionTool extends ToolBase {
    type: "function";
    parametersSchema: ZodSchema;          // zod v3 の ZodSchema
    checkParameters: (params: any) => void;
    implementation: (params: Record<string, unknown>, ctx: ToolCallContext) => any | Promise<any>;
}

export interface ToolCallContext {
    status: (text: string) => void;   // 必須
    warn: (text: string) => void;     // 必須
    signal: AbortSignal;              // 必須
    callId: number;                   // 必須
}
```

- `tool()` の戻り値型は **`Tool`（union）**。`parametersSchema` / `implementation` は `FunctionTool` にしか無いため、**型ガード（`t.type === 'function'`）で絞る必要がある**。本リポジトリの7ツールは全て実行時に FunctionTool。
- **現行アダプタのバグ的事実**: `lmTool.implementation(input, { abortSignal })` と呼んでいるが、`{ abortSignal }` は `ToolCallContext` を満たさない（`status`/`warn`/`signal`/`callId` 欠落、フィールド名も `signal` が正）。`any` なのでコンパイルが通っていただけ。**本リポジトリの全ツール実装は ctx を一切読まない**ため実害は無かった。型付けの際は正しい ToolCallContext スタブを渡す（`plan_p4.md` D3）。

### `ai` v6.0.208（確認済み）

- `dynamicTool` が export されている（`@ai-sdk/provider-utils` からの re-export）。**実行時に定義が決まるツールのための公式プリミティブ**で、今回の変換の正解:

```typescript
declare function dynamicTool(tool: {
    description?: string;
    inputSchema: FlexibleSchema<unknown>;
    execute: ToolExecuteFunction<unknown, unknown>;  // (input, options) => ...
    // ほか optional
}): Tool<unknown, unknown> & { type: 'dynamic' };
```

- `ToolSet`（`Record<string, Tool<...>>`）、`zodSchema`、`Tool`、`GenerateTextResult` も export 済み。
- `ToolExecuteFunction<INPUT, OUTPUT> = (input: INPUT, options: ToolExecutionOptions) => ...`。options には `abortSignal` 等が入る。

### zod

- ルートに **zod 3.25.76 が1つだけ**（SDK は自前 zod を持たずルートを共有）。バージョン分裂による型不整合の心配は無い。
- `parametersSchema`（zod3 ZodSchema）を `inputSchema` にそのまま渡せるはず。型が合わない場合のみ `ai` の `zodSchema()` でラップする（`plan_p4.md` D5）。

## 3. 保存すべき現行の実行時挙動（1バイトも変えない）

`tool-adapter.ts` の `execute` は以下の順序で動く。**型付け後も同一であること**:

1. `console.log('[Tool Execution] Running "<name>" with input:', input)`
2. `onInterceptExecute` があれば先に呼ぶ。戻り値が `undefined`/`null` **以外**ならそれを結果とする。**throw したら console.error して握りつぶし**、通常実行へフォールバック
3. 結果が未確定なら `lmTool.implementation(input, ctx)` を実行
4. `console.log('[Tool Execution Result] ...')` → `onExecute(input, toolResponse)` 通知
5. 結果が **string なら `JSON.parse` を試み、失敗したら `{ result: toolResponse }` にラップ**。string 以外はそのまま返す

呼び出し側（`chat-ai-service.ts`）:
- `vercelTools[t.tool.name] = convertLmStudioToolToVercel(t.tool, onExecuteコールバック, onInterceptコールバック)`
- `executedTools: Array<{ toolName: string; input: any; output: any }>` に蓄積し、生成後に `onToolResult` へ流す
- `generateOptions`（`any`）に条件付きで `tools` / `stopWhen` を載せ、リトライ時は `delete retryOptions.tools` / `delete retryOptions.stopWhen`

## 4. テストの現状

- **アダプタ単体のテストは存在しない**（P4 で新設する）。
- `chat-ai-service.test.ts`（9件）・`tool-use.test.ts`（18件）: 計 **27 passed** がベースライン。`generateText` はモックされるため、アダプタの型変更が既存テストに波及する経路は「モジュール読み込み」と「vercelTools の構築」のみ。
- 型チェック: `npx tsc --noEmit` は既存の警告が少数ある（tsconfig 非推奨系）。**着手前にベースラインを記録し、新規エラーを増やさない**こと。

## 5. スコープ外・触ってはいけないもの

- `src/skills/tool-use/`（レジストリ・ツール定義・prompts）— P3 で完成済み
- `src/connector/lmstudio-connector.ts`（`llm.act` 経路）
- `MascotTool` インターフェース（`tool: Tool` のまま）
- 実行時挙動全般（§3）、既存テストの期待値

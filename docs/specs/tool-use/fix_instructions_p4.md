# P4 修正指示書（for Gemini）: ツールアダプタの型付け

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 基準コミット | `0e5f185`（クリーンな作業ツリーから開始） |
| 必読順 | ①`walkthrough_p4.md` → ②`plan_p4.md` → ③本書 |

**walkthrough_p4.md §2 の型情報は検証済みの事実**である。SDK の d.ts を読み直すのは構わないが、そこに書かれた内容と食い違う実装（例: `Tool` を union でないとみなす、`ToolCallContext` の必須フィールドを省く）をしないこと。

---

## 0. 禁止事項（違反したら受け入れ不可）

1. **実行時挙動の変更**。`walkthrough_p4.md` §3 の5ステップ（intercept 優先・エラー握りつぶし・JSON.parse/`{result}` ラップ・ログ・onExecute 通知）を逐語的に保つ。
2. **`as any` / `any` の使用**（`tool-adapter.ts` 内）。型が合わない場合は `plan_p4.md` D5 のフォールバックか、報告して指示を仰ぐ。`unknown` + 明示的 narrowing は可。
3. **既存テストの期待値書き換え**。27件は無修正で通ること。
4. **スコープ外ファイルの変更**: `src/skills/tool-use/`、`src/connector/`、`src/utils/*-shared.ts`、prompts、`MascotTool` 型。
5. **`onToolResult` / `onToolExecute` の公開シグネチャ変更**（ws.ts に波及するため）。
6. **`generateOptions` の型付けで20分以上格闘すること**。`plan_p4.md` D4 のとおり `any` 残置がフォールバックとして認められている。残置した場合は報告に明記。

## 1. 開始前チェック

```bash
cd app
git status --porcelain    # クリーンであること
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts
# → 27 passed を確認
npx tsc --noEmit 2>&1 | tail -20   # 出力を保存（ベースライン。既存警告は増やさなければ無視してよい）
```

## 2. タスク

### T1: `src/server/utils/tool-adapter.ts` の書き直し
`plan_p4.md` D1〜D3, D5, D6 に従う。要点:
- import: `import { dynamicTool } from 'ai';` と `import type { Tool as LMTool, ToolCallContext } from '@lmstudio/sdk';`
- シグネチャ: `(lmTool: LMTool, onExecute?: (input: unknown, output: unknown) => void, onInterceptExecute?: (input: unknown) => Promise<unknown>)`
- 冒頭で `lmTool.type !== 'function'` なら throw（D1 のメッセージ文言を使用）
- `dynamicTool({ description, inputSchema, execute })` を返す
- `execute` 内は現行ロジックの逐語移植＋ ToolCallContext スタブ（D3）
- JSDoc コメント（日本語）は現行の趣旨を維持しつつ更新してよい

### T2: `src/server/utils/chat-ai-service.ts` の型更新
- `import { ..., ToolSet } from 'ai';`
- `const vercelTools: ToolSet = {};`
- `executedTools: Array<{ toolName: string; input: unknown; output: unknown }>`
- それ以外のロジック・行は触らない

### T3（任意・フォールバック可）: `generateOptions` の型付け
`Parameters<typeof generateText>[0]` を試す。`delete retryOptions.tools` / 条件付き代入と衝突して素直に通らなければ、**即座に `any` のまま残して先へ進む**（禁止事項6）。

### T4: アダプタ単体テストの新設
`src/server/utils/__tests__/tool-adapter.test.ts` を新規作成し、最低以下の5ケース:
1. implementation が **JSON 文字列**を返す → パース済みオブジェクトが返る
2. implementation が **非 JSON 文字列**を返す → `{ result: '<文字列>' }` にラップされる
3. `onInterceptExecute` が値を返す → **implementation は呼ばれず**、intercept の値が使われ、`onExecute` に通知される
4. `onInterceptExecute` が **throw** する → 握りつぶされ、implementation にフォールバックする
5. `lmTool.type` が `'function'` 以外 → throw する

テスト内のフェイクツールは `@lmstudio/sdk` の実 `tool()` で作ってよい（zod はルートに 3.25.76 がある）。execute の呼び出しは `await converted.execute(input, { toolCallId: 't1', messages: [] } as any)` のように **テスト側での options キャストは許可**（プロダクションコードでの `as any` 禁止と混同しないこと）。

### T5: 検証

```bash
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts src/server/utils/__tests__/tool-adapter.test.ts
# 既存27件無修正＋新規5件以上 = 32件以上成功
npx tsc --noEmit 2>&1 | tail -20
# ベースラインと比較して新規エラーゼロ
grep -n "any" src/server/utils/tool-adapter.ts
# → 0件（コメント内の日本語を除く）
```

## 3. 受け入れ条件

- [ ] `tool-adapter.ts` に `any`（`as any` 含む）が残っていない
- [ ] 実行時挙動が不変（既存27テスト無修正成功が証明）
- [ ] 新規アダプタテスト5ケース以上が成功
- [ ] `tsc --noEmit` 新規エラーゼロ
- [ ] スコープ外ファイルの diff がゼロ（`git status` で確認）

## 4. レポート要件
- 変更ファイル一覧、テスト件数、tsc 結果（ベースライン比）、D5 でどちらの方式（直接 or `zodSchema()` ラップ）を採ったかを報告。
- T3 をフォールバック（`any` 残置）にした場合はその旨と、遭遇した型エラーを報告。
- 計画と食い違う現実に遭遇した場合は独断で設計変更せず、差分と提案を列挙して報告。

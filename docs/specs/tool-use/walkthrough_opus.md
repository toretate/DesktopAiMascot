# P3 実装者向けコードウォークスルー（tool-use アーキテクチャ現状）

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 基準コミット | `1fdb5d6`（refactor: tool-useプロンプトのTSファイル分割とレビュー指摘の修正） |
| 目的 | P3（ツール二重定義＝レジストリのメタデータ統合）実装前に読む、現状アーキテクチャの案内 |
| 関連文書 | `plan_opus.md`（設計・手順）、`fix_instructions_opus.md`（作業指示） |

---

## 1. 全体像: ツールは1回定義され、2つの実行経路で使われる

```
                    src/skills/tool-use/          ← ツール定義の唯一の正（P1-2で統合済み）
                    ├── index.ts                  ← lmStudioTools: Tool[]（7ツール）
                    ├── *-tool.ts × 8             ← @lmstudio/sdk の tool() + zod で定義
                    └── prompts/*.prompt.ts       ← ツール別ガイドライン文字列（@prompt エイリアス）
                            │
        ┌───────────────────┴────────────────────┐
        ▼ 経路1: Vercel AI SDK                    ▼ 経路2: LM Studio ネイティブ
  src/server/utils/chat-ai-service.ts       src/connector/lmstudio-connector.ts
  （gemini / openai / lmstudio-OpenAI互換）   （Electron IPC から呼ばれる）
  convertLmStudioToolToVercel() で変換       llm.act() に tool() をそのまま渡す
  → generateText(tools, stopWhen)            （lmstudio-connector.ts:189）
```

- `src/server/skills/tool-use/index.ts` は re-export のみ（`export * from '../../../skills/tool-use'`）。server 側 import パス互換のために存在する。
- `manage-tasks-tool.ts` / `manage-memos-tool.ts` は `src/utils/task-tools-shared.ts` / `memo-tools-shared.ts` の re-export。これらの `implementation` はスタブで、実処理は `src/server/routes/ws.ts` がツール名（`manageTasks` / `manageMemos`）で分岐して行う。**ツール名の文字列は ws.ts でも参照されているので、名前を変えないこと。**

## 2. P3 が排除すべき「4つの手動同期ポイント」

1ツール追加時、現状は以下4箇所を手で揃える必要がある（manageMemos で実際に漏れた構造）:

| # | 場所 | 内容 |
| --- | --- | --- |
| ① | `chat-ai-service.ts:17` | `TOOL_PROMPTS: Record<string,string>`（7エントリ。ツール名→@promptガイドライン） |
| ② | `chat-ai-service.ts:200-217` | `filteredTools` の switch-case（configKey 5種、`default: return true`） |
| ③ | `lmstudio-connector.ts:149-167` | ②と同型の switch-case（コピー） |
| ④ | `lmstudio-connector.ts:170-175` | `activeToolDescriptions` の if 連鎖（configKey ごとに英語ラベル 'weather', 'volume', ... をハードコード） |

④は見落としやすい。connector は日本語の @prompt ガイドラインではなく、**独自の英語ガイドライン**（`# Tool Use Guidelines`）を組み立てており、その材料が④のラベル。

## 3. 設定フラグ（configKey）の現状

`src/store/config.ts:100-104` に5キーのみ定義:

```
toolsGpsLocation / toolsWeather / toolsVolume / toolsAppLauncher / toolsWebSearch
```

- 判定はすべて `tools ? tools.<key> !== false : true`（**設定オブジェクトが無ければ全有効、キーが undefined でも有効**）。この意味論を変えないこと。
- `manageTasks` / `manageMemos` には**キーが無く常時有効**（switch の `default: return true`）。これは現時点で意図された仕様。P3 では `configKey: undefined` として表現し、トグル新設はしない（プロダクト判断のため）。
- `tools` オブジェクトは 設定UI（`ChatGenSettingsPanel.vue`）→ `store/config.ts` → WS/IPC → `ws.ts` / connector へと流れ、`generateResponse({ tools })` / connector メソッドの引数に届く。型は `any`。

## 4. 経路1（ChatAiService）の処理の流れ

`src/server/utils/chat-ai-service.ts` の `generateResponse()`:

1. `:200` `filteredTools` = switch-case でフィルタ（同期ポイント②）
2. `:224-231` `activeToolDescriptions`（ツール名一覧）と `activeToolPrompts`（`TOOL_PROMPTS[t.name]`、同期ポイント①）を構築
3. ガイドラインテンプレート `@prompt/tool-use-guideline` の `{{toolUseSection}}` に流し込み、system prompt を「ペルソナ → ガイドライン → 時刻（分単位）」の順で結合
4. `:318` 付近で `convertLmStudioToolToVercel(t, onExecute, onIntercept)`（`src/server/utils/tool-adapter.ts`、全引数 `any`）により Vercel 形式へ変換し `vercelTools[t.name]` に登録
5. `generateText({ tools: vercelTools, stopWhen: stepCountIs(5), temperature: ツール有効時デフォルト0.2 })`
6. 応答後処理: 思考タグ除去 → `:479` `stripPseudoToolCalls(cleanedContent, filteredTools.map(t => t.name))` → 空応答フォールバック

**P3 で触るのは 1, 2, 4, 6 の `t.name` / `TOOL_PROMPTS` 参照部**。ラッパ導入後は `t.tool.name` / `t.prompt` になる。

## 5. 経路2（connector）の処理の流れ

`src/connector/lmstudio-connector.ts`:

1. `:149` switch-case フィルタ（同期ポイント③）
2. `:170-175` if 連鎖で英語ラベル収集（同期ポイント④）→ 英語ガイドライン組み立て → `replaceSystemPrompt`
3. `:189` `await llm.act(chatInstance, filteredTools, { onMessage })` — **`tool()` の戻り値をそのまま渡す**。ここが `@lmstudio/sdk` を撤去できない理由。

## 6. テストの現状（壊しやすいポイント）

- `src/skills/tool-use/__tests__/tool-use.test.ts`（15件）: **各ツールを個別 export から直接 import**している（`:31-36` `import { weatherTool } from '../weather-tool'` 等）。ツールファイルの export の形（`tool()` の戻り値そのもの）を変えるとここが壊れる。→ P3 の設計はこれを壊さない方式を採る（`plan_opus.md` 参照）。
- `src/server/__tests__/chat-ai-service.test.ts`（9件）: `generateText` をモックし、`mock.calls` から `system` / `tools` / `temperature` を検査。manageMemos ガイドライン注入・temperature 0.2・system prompt 順序のテストを含む。**P3 後もそのまま成功すべき**（挙動不変が正）。
- ベースライン: 対象2スイートで **24 passed**。フルスイートの既存失敗5ファイル（connector / useChatConnection / useSettingsWindow / expression-alignment×2）は P1/P2 以前からの既存問題。

## 7. ビルド・エイリアスの注意

- `@prompt` エイリアスは **tsconfig.json / nuxt.config.ts / vitest.config.ts の3か所**に定義（`src/skills/tool-use/prompts` を指す）。過去に vitest 分の追加漏れでテスト全滅が起きた。P3 でエイリアスを触る場合は3か所同時に。
- Electron main（`config-handler.ts`）も `@prompt/radio/*` を import しており、electron ビルドでも解決される実績がある。
- prompts は `export default` の TS 文字列モジュール（`?raw` は Nitro で ENOENT を起こした経緯があり不採用）。

## 8. 変えてはいけないもの（制約）

1. **`@lmstudio/sdk` の撤去・置換不可**（`llm.act` が現役）。
2. **ツール名文字列（`manageTasks` 等）の変更不可**（`ws.ts` が名前で分岐、`stripPseudoToolCalls` も名前でマッチ）。
3. **フィルタの意味論**（`!tools` → 全有効、`key !== false` 判定、configKey 無し → 常時有効）**の変更不可**。
4. タイマー相互排他ルールは manageTasks の prompt に置いたまま（共通ガイドラインへ移さない）。
5. 適用済み修正（P1/P2、`stripPseudoToolCalls` 等）の巻き戻し不可。

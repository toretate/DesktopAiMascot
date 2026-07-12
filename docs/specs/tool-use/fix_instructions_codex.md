# tool-use 修正指示書（for Codex）

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 最終更新 | 2026-07-12 |
| 対象ブランチ | `featue/tools/memo` |
| 根拠文書 | `review_claude.md` |

## 対応状況

Codex 実行環境の不調（sandbox セットアップ不全で編集不可）のため、**P1/P2 は Claude が実装済み**。完了タスクの指示本文は削除した（実装内容は下表と git 履歴を参照）。

| タスク | 状況 | 備考 |
| --- | --- | --- |
| P1-1 manageMemos 同期漏れ | ✅ 完了 | `manageMemos.prompt.ts` 新規作成＋`TOOL_PROMPTS` 追加 |
| P1-2 二重ツリー統合 | ✅ 完了 | `src/skills/tool-use/` を正に統合。`src/server/skills/tool-use/` は re-export の index のみ |
| P2-1 temperature 低減 | ✅ 完了 | ツール有効＋未指定時のみ 0.2（ユーザー指定優先） |
| P2-2 timeInstruction | ✅ 完了 | 分単位化＋「ペルソナ→ガイドライン→時刻」順 |
| P3 メタデータ統合 | ✅ 完了 | Gemini 3.5 Flash が `walkthrough_opus.md` / `plan_opus.md` / `fix_instructions_opus.md` に基づき実装、Opus レビュー承認＋Claude 独立検証済み（27 passed、旧シンボル残存0、既存テスト無修正） |

検証済みベースライン: 対象スイート **24 passed**（chat-ai-service 9 + tool-use 15）。フルスイートで失敗する5ファイル（connector / useChatConnection / useSettingsWindow / expression-alignment×2）は既存問題（ベースラインでも同一失敗を確認済み）。

---

## 0. 前提・禁止事項（必読）

1. **`@lmstudio/sdk` を削除・置換しないこと。**
   `app/src/connector/lmstudio-connector.ts:189` の `llm.act(chatInstance, filteredTools, …)` が SDK の `tool()` 定義をネイティブ実行経路で現役利用している。
2. **適用済みの修正（上表 P1/P2 および `@prompt` vitest エイリアス、`stripPseudoToolCalls()` 等）を巻き戻さないこと。**
3. **時刻注入を「履歴途中の system メッセージ」にしないこと。**
   `@ai-sdk/google`（v3.0.83 で確認）は先頭以外の system メッセージで throw する。
4. **タイマータグとの相互排他ルールを共通ガイドライン（`tool-use-guideline.ts`）へ移さないこと。**
5. テストのベースライン: `npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts`（`app/` 直下）で **24件成功**の状態から開始し、これを下回らないこと。

---

## P3: レジストリのメタデータ統合（データ駆動化）— 未着手

### 目的
1ツール追加時の手動同期箇所（ツール実装 / prompt ファイル / `TOOL_PROMPTS` / ChatAiService 側 switch / connector 側 switch / index）を、ツールオブジェクト自身のメタデータに一本化し、manageMemos 型の同期漏れを構造的に根絶する。

### 実装方針
1. 各ツール定義を薄いラッパで包み、メタデータを付与する:

   ```typescript
   export interface MascotTool {
       tool: Tool;                 // @lmstudio/sdk の tool() 戻り値
       configKey?: string;         // 例: 'toolsWeather'。undefined なら常時有効
       prompt: string;             // @prompt/*.prompt.ts の内容
   }
   ```

2. `chat-ai-service.ts` の `filteredTools` switch-case と `TOOL_PROMPTS` を削除し、メタデータ参照に置換:

   ```typescript
   const filteredTools = mascotTools.filter(t => !tools || t.configKey === undefined || tools[t.configKey] !== false);
   const activeToolPrompts = filteredTools.map(t => t.prompt.trim());
   ```

3. `lmstudio-connector.ts:149` の同型 switch-case も同じメタデータで置換（`llm.act` へは `t.tool` を渡す）。
4. `manageTasks` / `manageMemos` に configKey を新設するか（設定UIへのトグル追加を含む）は**プロダクト判断のため実装せず、`configKey: undefined`（常時有効）のまま**とし、TODO コメントを残す。

### 受け入れ条件
- `TOOL_PROMPTS` と2箇所の switch-case が消滅。
- ツールを1つ追加する際に触るファイルが「ツール定義＋prompt ファイル＋index 1行」のみになる。
- ベースライン24件を含む全対象テスト成功＋フィルタリングのユニットテスト追加（configKey 無効化・常時有効の両方）。

---

## 検証

```bash
cd app
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts
# 24件（＋P3で追加した分）が全て成功すること
```

## レポート要件
- 完了/未完了、変更ファイル一覧、テスト結果（件数）を報告すること。
- 判断に迷う点があれば独断で進めず必ず列挙して報告すること。

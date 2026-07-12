# P3 修正指示書（for Opus）: ツールレジストリのメタデータ統合

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 基準コミット | `1fdb5d6`（クリーンな作業ツリーから開始すること） |
| 対象ブランチ | `featue/tools/memo`（または派生ブランチ） |
| 必読 | ①`walkthrough_opus.md`（現状理解）→ ②`plan_opus.md`（設計判断）→ ③本書 の順で読むこと |

本書は作業指示のみを扱う。**なぜこの設計か（案A採用理由・D1〜D5）は `plan_opus.md`、コードの現在地は `walkthrough_opus.md` に記載済み**であり、そこと矛盾する実装をしないこと。

---

## 0. 禁止事項（違反したら受け入れ不可）

1. `@lmstudio/sdk` の削除・置換（`llm.act` が現役利用中）。
2. ツール名文字列（`manageTasks` / `manageMemos` 等）の変更（`ws.ts` が名前で分岐している）。
3. フィルタ意味論の変更（`!tools` → 全有効 / `tools[key] !== false` / configKey 無し → 常時有効）。
4. 各 `*-tool.ts` および `task-tools-shared.ts` / `memo-tools-shared.ts` の **export 形状の変更**（`tool-use.test.ts` が個別 import している）。
5. `manageTasks` / `manageMemos` への設定トグル新設（UI含む）。`configKey: undefined` のまま TODO コメントを残す。
6. P1/P2 適用済み修正（`stripPseudoToolCalls`、temperature 0.2、時刻の位置・粒度、`@prompt` エイリアス）の巻き戻し。
7. タイマー相互排他ルールの共通ガイドライン移動。

## 1. 開始前チェック

```bash
cd app
git status --porcelain   # クリーンであること
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts
# → 24 passed を確認してから着手
```

## 2. タスク

### T1: `src/skills/tool-use/index.ts` — メタデータレジストリ化
- `MascotTool` インターフェースを定義（`plan_opus.md` D2 のとおり: `tool` / `configKey?` / `label` / `prompt`）。
- `@prompt/*.prompt.ts` を import し、`mascotTools: MascotTool[]` を7エントリで定義。**configKey / label の値は `plan_opus.md` ステップ1の表に従うこと**（勝手に変えない）。
- `filterEnabledTools(tools?)` を定義（`plan_opus.md` D3 のコードを逐語で使用）。
- `lmStudioTools` export を**削除**（参照2箇所は T2/T3 で置換する）。

### T2: `src/server/utils/chat-ai-service.ts` — レジストリ参照へ置換
- 削除: `TOOL_PROMPTS` 定数、ツール別 prompt の個別 import 6行（`tool-use-guideline` の import は**残す**）、`filteredTools` の switch-case。
- 置換: `const filteredTools = filterEnabledTools(tools);`
- 更新: `activeToolDescriptions.push(t.tool.name)` / `activeToolPrompts.push(t.prompt.trim())` / `vercelTools[t.tool.name] = convertLmStudioToolToVercel(t.tool, …)` / `executedTools` の `toolName: t.tool.name` / `onToolExecute(t.tool.name, args)` / `stripPseudoToolCalls(cleanedContent, filteredTools.map(t => t.tool.name))`。
- 完了後、ファイル内に `TOOL_PROMPTS` / `lmStudioTools` が残っていないこと（grep で確認）。

### T3: `src/connector/lmstudio-connector.ts` — 同期ポイント③④の置換
- 削除: `:149` の switch-case フィルタ、`:170-175` の `activeToolDescriptions` if 連鎖。
- 置換: `const filteredTools = filterEnabledTools(tools);` / `const activeToolDescriptions = filteredTools.map(t => t.label);`
- `llm.act(chatInstance, filteredTools.map(t => t.tool), { onMessage: … })` に変更。
- 注意: これにより英語ガイドラインに `task management` / `memo management` が新たに載る。**意図的変更**（`plan_opus.md` D5）なのでそのままでよい。

### T4: テスト追加
`src/skills/tool-use/__tests__/tool-use.test.ts` に追記（または同ディレクトリに新ファイル）:
1. レジストリ整合性: `mascotTools` 全エントリで `prompt` 非空・`label` 非空・`tool.name` 一意。
2. フィルタ挙動: (a) 引数なし→7件 (b) `{ toolsWeather: false }` → `getWeather` のみ除外 (c) `{ toolsWeather: false }` でも `manageTasks` / `manageMemos` は残る（configKey 無し＝常時有効の固定化）。

### T5: 検証
```bash
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts
```
- 既存24件は**無修正のまま**全て成功すること。**既存テストの期待値を書き換えて通すのは禁止**（挙動が変わった証拠なので、実装側を直すこと。唯一の例外は T3 の英語ガイドライン文言に依存するテストが存在した場合のみで、その際は理由を報告に明記）。
- 置換漏れ確認: `grep -rn "TOOL_PROMPTS\|lmStudioTools" src/`（`app/` 直下で実行）が **0件**であること。
- 可能なら手動スモーク: LM Studio 起動状態で「大阪の天気は？」「買い物メモに牛乳」「音量を下げて」を確認。

## 3. 受け入れ条件（全て満たすこと）

- [ ] 4つの同期ポイント（`TOOL_PROMPTS` / 2つの switch / if 連鎖）が消滅している
- [ ] `mascotTools` がツール登録の唯一のレジストリになっている（ツール追加時に触るのは「ツール実装＋prompt ファイル＋index の1エントリ」のみ）
- [ ] 既存24テストが無修正で成功＋T4 の新規テストが成功
- [ ] 禁止事項0の全項目に抵触していない
- [ ] `grep` で旧シンボルの残存ゼロ

## 4. レポート要件

- 変更ファイル一覧、テスト結果（件数）、grep 確認結果を報告。
- 実装中に `plan_opus.md` の設計と食い違う現実（型が合わない、想定外の参照箇所など）を見つけた場合は、**独断で設計変更せず**、差分と提案を列挙して報告すること。

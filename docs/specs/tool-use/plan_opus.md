# P3 実装計画: ツールレジストリのメタデータ統合

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-12 |
| 基準コミット | `1fdb5d6` |
| 前提文書 | `walkthrough_opus.md`（先に読むこと）、作業指示は `fix_instructions_opus.md` |

## ゴール

1ツール追加時に手で揃える4つの同期ポイント（`TOOL_PROMPTS` / ChatAiService switch / connector switch / connector 英語ラベル if 連鎖）を、**ツールごとのメタデータ1エントリ**に集約する。完了後、ツール追加で触るのは「ツール実装ファイル＋prompt ファイル＋index の1エントリ」のみになる。

## 設計判断

### D1. メタデータの持ち方 — 集中レジストリ方式（index.ts でラップ）を採用

| 案 | 内容 | 判定 |
| --- | --- | --- |
| A: 集中レジストリ | 各 `*-tool.ts` は現状のまま（`tool()` の戻り値を export）。`index.ts` がメタデータ付きでラップした配列を組み立てる | **採用** |
| B: ツールファイル内ラップ | 各 `*-tool.ts` の export を `MascotTool` 型に変える | 不採用 |

理由: 案Bは `tool-use.test.ts` が個別 export を直接 import している（walkthrough §6）ため15件のテスト修正が必要になり、また `task-tools-shared.ts` / `memo-tools-shared.ts`（他所からも参照される共有モジュール）の export 形状にも波及する。案Aは**既存 export を一切壊さず**、レジストリは index の1箇所に保てる。

### D2. 型定義

```typescript
import type { Tool } from '@lmstudio/sdk';

export interface MascotTool {
    /** @lmstudio/sdk の tool() 戻り値。llm.act へはこれを渡す */
    tool: Tool;
    /** 設定トグルのキー（store/config.ts のキー名）。undefined なら常時有効 */
    configKey?: string;
    /** connector の英語ガイドライン用の短いラベル（例: 'weather'） */
    label: string;
    /** ChatAiService の system prompt に注入するツール別ガイドライン（@prompt 由来） */
    prompt: string;
}
```

- `Tool` 型が `@lmstudio/sdk` から export されていない場合は `ReturnType<typeof tool>` 等で代替し、無理なら `unknown` ではなく既存同様の実用型で妥協してよい（ここで型パズルに時間を使わない）。
- `configKey` を `keyof` で config 型に縛るのは、`tools` パラメータが現状 `any` で流れてくるため見送り（P3 スコープ外）。

### D3. フィルタロジックの一本化

両経路の switch を、共有ヘルパー1つに置き換える。**意味論は現状と完全一致**させる（`!tools` → 全有効 / `tools[key] !== false` / `configKey` 無し → 常時有効）:

```typescript
// src/skills/tool-use/index.ts
export function filterEnabledTools(tools?: Record<string, boolean | undefined> | null): MascotTool[] {
    return mascotTools.filter(t =>
        !tools || t.configKey === undefined || tools[t.configKey] !== false
    );
}
```

### D4. `lmStudioTools` export の扱い — 削除

参照箇所は `chat-ai-service.ts:1` と `lmstudio-connector.ts:2` の2つのみで、どちらも本リファクタで `mascotTools` / `filterEnabledTools` に置き換える。互換 export を残すと「どちらを使うべきか」の混乱源になるため削除する。`src/server/skills/tool-use/index.ts` は `export *` なので変更不要。

### D5. connector の英語ラベル

同期ポイント④（if 連鎖）は `filterEnabledTools(tools).map(t => t.label)` に置き換える。現状ラベル（'weather', 'volume', 'app launching', 'web search', 'location'）を metadata に転記。manageTasks / manageMemos は現状④に**含まれていない**（英語ガイドラインに出ていない）が、これは漏れの一種とみなし `label: 'task management'` / `'memo management'` を与えて含める。挙動変化はガイドライン文字列のみで、ツール公開自体は従来から7ツールなので影響は軽微。

## 実装ステップ

1. **`src/skills/tool-use/index.ts` を書き換え**: `MascotTool` 型、prompts の import、`mascotTools: MascotTool[]`（7エントリ、下表）、`filterEnabledTools()` を定義。`lmStudioTools` を削除。

   | tool | configKey | label |
   | --- | --- | --- |
   | gpsLocationTool | `toolsGpsLocation` | `location` |
   | weatherTool | `toolsWeather` | `weather` |
   | volumeTool | `toolsVolume` | `volume` |
   | appLauncherTool | `toolsAppLauncher` | `app launching` |
   | webSearchTool | `toolsWebSearch` | `web search` |
   | manageTasksTool | `undefined`（常時有効。トグル新設はプロダクト判断待ち — TODO コメントを残す） | `task management` |
   | manageMemosTool | `undefined`（同上） | `memo management` |

2. **`chat-ai-service.ts` を置換**: `TOOL_PROMPTS` と prompts の個別 import（`tool-use-guideline` は残す）、switch-case を削除。`filteredTools = filterEnabledTools(tools)`、ガイドラインは `t.prompt`、ツール名参照（`vercelTools[t.name]`、`stripPseudoToolCalls` の names、`executedTools` の toolName、adapter への引数）を `t.tool` / `t.tool.name` に更新。

3. **`lmstudio-connector.ts` を置換**: switch-case と if 連鎖を削除し `filterEnabledTools(tools)` に。`llm.act(chatInstance, filteredTools.map(t => t.tool), …)`。英語ラベルは `t.label`。

4. **テスト追加**（`tool-use.test.ts` または新ファイル）:
   - レジストリ整合性: `mascotTools` の全エントリで `prompt` が非空、`tool.name` が一意、`label` が非空。
   - フィルタ: `tools` 未指定→7件 / `{ toolsWeather: false }`→weather のみ除外 / configKey 無しツールはどんな設定でも残る。

5. **検証**: 対象2スイート（ベースライン24件＋追加分）成功。既存の chat-ai-service テスト9件は**無修正のまま**成功すること（挙動不変の証明）。

## リスクと対策

| リスク | 対策 |
| --- | --- |
| `Tool` 型が SDK から export されていない | D2 のフォールバック（`ReturnType<typeof tool>`）。型解決に固執しない |
| フィルタ意味論の微妙な差（`!tools` の扱い等） | D3 のヘルパーに現状ロジックを逐語で移植し、ステップ4のフィルタテストで固定 |
| connector 英語ガイドラインの文言変化（manageTasks/Memos ラベル追加） | 意図的な変更として PR 説明に明記。ローカルモデルの挙動確認は手動スモークで |
| `t.name` → `t.tool.name` の置換漏れ | `chat-ai-service.ts` / `lmstudio-connector.ts` 内で旧 `lmStudioTools` / `TOOL_PROMPTS` を grep して残存ゼロを確認 |

## スコープ外（やらないこと）

- `manageTasks` / `manageMemos` の設定トグル新設（UI 変更含む）— プロダクト判断待ち
- `convertLmStudioToolToVercel` の型付け改善（レビュー項目A）— 別タスク
- `@lmstudio/sdk` の撤去、ツール名変更、フィルタ意味論の変更 — 禁止事項（walkthrough §8）

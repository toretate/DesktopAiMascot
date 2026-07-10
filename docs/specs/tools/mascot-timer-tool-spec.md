# マスコットタイマー ツール 実装仕様書

> **対象読者**: 本リポジトリを実装する別AI（および人間の実装者）。
> **本書の使い方**: §1 のゴールを満たすことが目的。§4 の手順とコード骨子に従い、§7 の受け入れ基準を全て満たすこと。識別子・パス・イベント名は本書の記載を正とする。未決事項（§10）は実装前に確認するか、記載の既定値を採用すること。

---

## 1. ゴール / スコープ

### 1.1. 作るもの
マスコットの一時的リマインドを、応答テキストのタグ規約（現状）から、**正式な LLM ツール `setMascotTimer` に昇格**させる。指定秒数の経過後にマスコットが一度だけ通知する。**永続化しない**（タスク一覧に入れない）。

### 1.2. スコープに含む
- 新ツール `setMascotTimer` の定義・登録・サーバー側ディスパッチ実装。
- タイマー発火（既存の通知配信経路の再利用）。
- システムプロンプトの調整（タグ指示 → ツール利用へ）。
- 既存 `[TIMER:]` タグ方式のフォールバック維持。
- テストと受け入れ基準の充足。

### 1.3. スコープに含まない（非対象）
- 永続化、タスク一覧への表示、キャンセルUI、繰り返し/定期通知。
- `manageTasks`（永続タスク側）の変更。
- 通知の見た目（吹き出し/OS通知）の変更（既存流用）。

---

## 2. 背景と現状

「予定・リマインド」には **2系統** があり役割が異なる。本ツールは前者。

| | マスコットタイマー（本ツール） | manageTasks（既存・変更しない） |
|---|---|---|
| 目的 | その場限りの一度きり通知 | 一覧管理する永続タスク/予定 |
| 永続化 | しない（`setTimeout` のみ） | する（`tasks.json`） |
| 代表依頼 | 「3分後に通知して」 | 「明日15時に会議」「レポートを書く」 |

**現状の実装（これを置き換える／併存させる）**: LLM 応答末尾のタグ `[TIMER:秒数,内容]` を `app/src/server/routes/ws.ts` が正規表現 `\[TIMER:(\d+),(.+?)\]` で解析し、`setTimeout` 後に `broadcastToUser(userId, 'timer-trigger', { memo })` を配信している。プロンプト注入は `app/src/components/chatpanel/useChatConnection.ts` の「# Timer Instructions」。

---

## 3. ツール定義（実装契約）

この repo のツールは `@lmstudio/sdk` の `tool({...})` で定義し、`parameters` は zod（既存 `app/src/utils/task-tools-shared.ts` を参照）。`implementation` は **スタブ**（引数をそのまま JSON で返す）で、実処理は `ws.ts` の `onToolExecute` インターセプタで行う（`manageTasks` と同一パターン）。

- **name**: `setMascotTimer`
- **description**（そのまま採用可）:
  > その場限りの一時的なリマインド／通知を設定します。指定した秒数の経過後に、マスコットが一度だけ声かけ・通知します。これはキッチンタイマーやアラームのようなもので、ユーザーのタスク一覧（TODO/予定）には保存されません。「3分後に通知して」「10分後に教えて」「カップ麺ができたら知らせて」のような一時的な依頼にのみ使用してください。後から一覧で管理・確認したいTODOや予定は、このツールではなく manageTasks を使ってください。
- **parameters**:

| 名前 | 型(zod) | 必須 | 説明 |
|---|---|---|---|
| `durationSeconds` | `z.number().int().positive()` | ✅ | 何秒後に通知するか。相対時間を秒換算（例: 3分後→180）。 |
| `message` | `z.string().min(1)` | ✅ | 通知内容（例:「カップラーメンができました！」）。 |

- **戻り値（`onToolExecute` が返す JSON 文字列）**:
  - 成功: `{ "success": true, "durationSeconds": <n>, "message": "<s>" }`
  - 失敗: `{ "success": false, "error": "<理由>" }`
- **副作用**: サーバーでタイマー登録し、経過後に該当ユーザーへ `timer-trigger` を配信。**永続書き込みは禁止**。

---

## 4. 実装手順

### 4.1. ツール定義ファイルを新規作成
`app/src/server/skills/tool-use/set-mascot-timer-tool.ts`（`manageTasks` のスタブ実装と同様）:

```ts
import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

export const setMascotTimerTool = tool({
    name: 'setMascotTimer',
    description: '（§3 の description をそのまま）',
    parameters: {
        durationSeconds: z.number().int().positive().describe('何秒後に通知するか。相対時間を秒換算（例: 3分後→180）。'),
        message: z.string().min(1).describe('通知内容。')
    },
    // 実処理は ws.ts の onToolExecute で行うため、ここはスタブ（引数をそのまま返す）
    implementation: async ({ durationSeconds, message }) => {
        return JSON.stringify({ success: true, durationSeconds, message });
    }
});
```

### 4.2. レジストリに登録
`app/src/server/skills/tool-use/index.ts` の `lmStudioTools` 配列に `setMascotTimerTool` を追加。

### 4.3. サーバー側ディスパッチ（`app/src/server/routes/ws.ts`）
`onToolExecute` は現在 `if (toolName !== 'manageTasks') return null;` で早期 return している。**このガードより前**に `setMascotTimer` 分岐を追加する。`userId` と `broadcastToUser` は同スコープで利用可能（既存タイマー処理と同じ）。

```ts
onToolExecute: async (toolName, args) => {
    const userId = ((peer as any).ctx && (peer as any).ctx.userId) || 'anonymous';

    if (toolName === 'setMascotTimer') {
        const seconds = Number(args.durationSeconds);
        const message = (args.message || '').trim();
        if (!Number.isInteger(seconds) || seconds <= 0) {
            return JSON.stringify({ success: false, error: 'durationSeconds は正の整数秒で指定してください。' });
        }
        if (seconds > 86400) { // §6 の上限
            return JSON.stringify({ success: false, error: 'タイマーは最大24時間(86400秒)までです。' });
        }
        if (!message) {
            return JSON.stringify({ success: false, error: 'message は必須です。' });
        }
        setTimeout(() => {
            broadcastToUser(userId, 'timer-trigger', { memo: message });
        }, seconds * 1000);
        return JSON.stringify({ success: true, durationSeconds: seconds, message });
    }

    if (toolName !== 'manageTasks') {
        return null;
    }
    // …既存の manageTasks 分岐…
}
```

### 4.4. `onToolResult` の扱い
`setMascotTimer` は **タスクではない**ため、`onToolResult` で **`task-action` イベントを送ってはいけない**。既存の `if (toolName !== 'manageTasks') return;` の早期 return によって自動的に対象外になる（＝追加変更不要）。この不変条件を壊さないこと。

### 4.5. システムプロンプトの調整（`app/src/components/chatpanel/useChatConnection.ts`）
「# Timer Instructions」ブロックを、タグ生成の指示から **`setMascotTimer` ツール利用の指示**へ変更する。ただし §4.6 のフォールバックのため、タグ書式の記述は残してもよい。相互排他ルール（一時通知=タイマー / 永続=manageTasks、履歴の過去依頼は再登録しない）は現行の記述を維持すること。

### 4.6. `[TIMER:]` タグのフォールバック維持（後方互換）
`ws.ts` の既存タグパース（`\[TIMER:(\d+),(.+?)\]` → `setTimeout` → `broadcastToUser`）と `cleanReply` によるタグ除去は **削除しない**。ツール非対応モデルや、モデルがタグを出した場合の保険として残す。二重発火に注意（同一応答でツール呼び出しとタグの両方が出た場合の扱いは §10 の未決事項）。

### 4.7. 有効/無効フラグ（任意・既定は常時有効）
`app/src/server/utils/chat-ai-service.ts` の `filteredTools` の switch は既定 `return true`。タイマーを設定で切りたい要件が無ければ **フラグ追加不要**（常時有効）。追加する場合は `tools.toolsTimer !== false` 等のケースを足し、設定 UI/ストアにもフラグを追加すること。

---

## 5. データ / イベント契約

- **WS イベント**（サーバー→クライアント）: `timer-trigger`、ペイロード `{ memo: string }`。**この形を変えない**（既存クライアント/IPC が依存）。
- **以降の通知経路（変更不要・流用）**:
  1. `useChatConnection.ts` が `timer-trigger` 受信 → `window.electronAPI.triggerTimerNotification(memo)`。
  2. `app/electron/preload.ts` → IPC `trigger-timer-notification`。
  3. `app/electron/ipc-handlers/schedule-handler.ts` `triggerTimerNotifications(memo)` → 各ウィンドウへ `timer-trigger` 送信＋OS通知。
  4. `app/src/components/MascotViewer.vue` `onTimerTrigger` → 吹き出し＋「surprised」表情＋TTS。

---

## 6. バリデーション / エラー処理
- `durationSeconds`: 正の整数のみ。下限 1 秒、上限 **86400 秒（24時間）**。範囲外は失敗 JSON を返し、タイマーを登録しない。
- `message`: 空文字不可（trim 後）。
- 失敗時はツール結果として `{ success: false, error }` を返し、モデルがユーザーに理由を伝えられるようにする（例外を投げない）。

---

## 7. 受け入れ基準（Acceptance Criteria）
1. 「3分後に通知して」と依頼 → モデルが `setMascotTimer({durationSeconds:180, message:...})` を呼ぶ。約180秒後にマスコットが1回通知する。
2. 上記の依頼で **タスク一覧（TODO/予定）に項目が増えない**（`tasks.json` に書き込まれない）。
3. 「明日15時に会議を入れて」等の永続依頼では `setMascotTimer` を呼ばず、`manageTasks add` が呼ばれる。
4. 会話履歴に過去の「3分後に通知して」が残っていても、無関係な新規メッセージ送信でタイマーが再設定されない。
5. `durationSeconds` が 0/負/非整数、または `message` 空のとき、タイマー登録されず失敗が返る。
6. 既存の `[TIMER:]` タグを含む応答でも従来どおり通知が発火する（後方互換）。
7. 既存テスト（`app/src/server/__tests__/*`、`app/src/store/__tests__/task.test.ts`）が緑のまま。

---

## 8. テスト観点
- **単体**: `onToolExecute('setMascotTimer', args)` の戻り値（成功/各バリデーション失敗）。`setTimeout`/`broadcastToUser` はフェイクタイマー・スパイで検証（`vi.useFakeTimers()`）。永続化（`tasks.json`）が発生しないこと。
- **回帰**: `setMascotTimer` 実行時に `task-action` が送信されないこと。
- **ルーティング**（可能なら）: `verify-standard-path.test.ts` に倣い、代表プロンプトで正しいツールが選ばれるかをライブ確認（ネットワーク依存のため任意）。

---

## 9. 非対象 / 後方互換
- 非対象は §1.3。特に **永続化・一覧表示・キャンセル・定期通知は実装しない**。
- 後方互換: `timer-trigger` ペイロード形状、`[TIMER:]` フォールバック、`manageTasks` の挙動を変更しない。

---

## 10. 前提・未決事項（実装前に確認）
1. **ツールとタグの二重発火**: 同一応答で `setMascotTimer` 呼び出しと `[TIMER:]` タグが同時に出た場合、どちらか一方のみ発火させたい。既定案: ツール呼び出しがあればタグは無視（`ws.ts` でツール実行済みフラグを持ち、タグ処理をスキップ）。この方針で良いか。
2. **有効/無効フラグ**（§4.7）: タイマーを設定で切れるようにするか。既定: 常時有効（フラグ無し）。
3. **相対時刻の換算主体**: 「3分後」→秒への換算は LLM に任せる（`durationSeconds` で受ける）前提。サーバーで自然言語の相対時刻を解釈する必要はない。
4. **多重登録の上限**: 1ユーザーが同時に大量のタイマーを設定した場合の上限は設けない（必要なら別途）。

---

## 11. 関連ファイル
- `app/src/server/skills/tool-use/index.ts` — ツールレジストリ（登録先）
- `app/src/utils/task-tools-shared.ts` — 既存 `manageTasks` 定義（スキーマ/スタブの参考）
- `app/src/server/routes/ws.ts` — `onToolExecute`/`onToolResult`、既存 `[TIMER:]` パースと `broadcastToUser`
- `app/src/server/utils/chat-ai-service.ts` — 標準ツール呼び出し経路、`filteredTools`、ツール使用ガイドライン
- `app/src/server/utils/tool-adapter.ts` — LM Studio ツール→Vercel 変換（`convertLmStudioToolToVercel`）
- `app/src/components/chatpanel/useChatConnection.ts` — タイマー指示のプロンプト注入 / `timer-trigger` 受信
- `app/electron/ipc-handlers/schedule-handler.ts`, `app/electron/preload.ts`, `app/src/components/MascotViewer.vue` — 通知の後段（変更不要）
- `docs/specs/widgets/task-management/task-management-spec.md` — 永続タスク側の仕様（棲み分けの相手方）

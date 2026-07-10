# 定期予定（繰り返しタスク / Repeat Schedule）機能 仕様書

> **本書のステータス**: 設計仕様（実装前）。既存のタスク管理ウィジェットに「毎日／毎週／毎月」等の繰り返し予定を追加する場合の設計・実装契約を定める。
> **前提**: 既存の単発 `scheduledAt` と通知パイプライン（§2）を拡張する形で実装する。破壊的変更をせず、既存タスク（`recurrence` なし）は従来どおり単発扱いのまま動くこと（後方互換）。
> **関連**: `docs/specs/widgets/task-management/task-management-spec.md`（ウィジェット本体）、`docs/specs/tools/mascot-timer-tool-spec.md`（一時通知＝別系統）。

---

## 1. ゴール / スコープ

### 1.1. 作るもの
予定付きタスク（`scheduledAt` を持つタスク）に**繰り返しルール（recurrence）**を付与し、指定周期で予定日時が自動的に次回へ更新され、毎回リマインド通知が飛ぶようにする。「毎朝の薬」「毎週月曜の定例」「毎月1日の家賃」のような定期予定を一覧で管理できる。

### 1.2. スコープに含む
- タスクへの繰り返しルール付与（毎日／毎週／毎月／毎年 + 間隔 + 曜日指定 + 終了条件）。
- 完了時に次回予定へ自動繰り越し（ロール）し、通知フラグをリセットする挙動。
- 繰り返し予定の通知（既存 `task-notification.ts` の 10 秒ポーリングを拡張）。
- スケジュール設定UI（既存カレンダー/クロックピッカー画面に「繰り返し」設定を追加）。
- `manageTasks` ツールの繰り返しパラメータ拡張（会話から定期予定を作れる）。
- 完了履歴の扱い（COMP ビュー）。

### 1.3. スコープに含まない（非対象）
- タイマー（一時通知）側の変更。定期通知でも「一覧に残さない一度きり」はタイマーの担当（棲み分けは task-management-spec / mascot-timer-tool-spec に従う）。
- タイムゾーンをまたぐ高度な RFC 5545 完全準拠（`RRULE` の全機能）。本仕様は実用サブセット（§4）。
- 祝日除外・営業日計算・「第2月曜」等の序数指定（将来拡張・§10）。

---

## 2. 現状の仕組み（拡張のベースライン）

繰り返し機能は以下の**既存経路を拡張**して実装する。新規のスケジューラは原則作らない。

### 2.1. データモデル
- クライアント: `app/src/store/task.ts` の `interface Task`（`scheduledAt?: string`, `notified?: boolean`, `completed`, `status`, `endedAt?`, `order`, `createdAt` 等）。
- サーバー: `app/src/server/utils/tasks-service.ts` がユーザー別 `USERS_DIR/<userId>/tasks.json` に保存。タスク生成時に `notified:false`, `status:'todo'`, `scheduledAt` を付与（`addTaskToDb`）。

### 2.2. 通知パイプライン（**クライアント側ポーリング**）
- `app/src/utils/task-notification.ts` の `startNotificationCheck()` が **10 秒間隔の `setInterval`**（`task-notification.ts:85`）で全タスクを走査。
- 発火条件（`task-notification.ts:57-69`）: `scheduledAt` があり、未完了・未通知（`!notified`）で、`now` が「予定時刻 − `notificationMinutes` 分」〜「予定時刻 **+10 分**」の窓に入っているタスク。
- ⚠️ **キャッチアップ打ち切り**: この「+10 分」カットオフのため、アプリが窓の間ずっと閉じていた予定は**一度も通知されない**。取りこぼしのバックフィル機構は無い。定期予定で長時間未起動だった場合の扱いは §5.3 の設計で考慮する。
- ⚠️ **`notified` はリセットされない**: `updateTaskInDb`/store の `updateTask` は `scheduledAt` を変えても `notified` を戻さない。繰り返しで次回へ進める際は**必ず `notified=false` を明示リセット**すること（§5.1）。
- 発火時（`task-notification.ts:71-84`）: **即座に `task.notified = true` にして保存**（二重通知防止）→ `window.electronAPI.triggerTimerNotification(text)` で OS 通知 + マスコット通知 → `playNotificationVoice` で TTS。
- Electron 側（`app/electron/ipc-handlers/schedule-handler.ts`）は**通知の中継のみ**（`trigger-timer-notification` → `triggerTimerNotifications`）。スケジュール判定ロジックは持たない。
- 通知の ON/OFF・何分前かは `enableNotification` / `notificationMinutes`（既定 5 分、store & tasks.json 両方に保持）。

### 2.3. 完了フロー
- TODO→DONE は `completionGraceSeconds`（既定 5 秒）の猶予後に確定（`TaskManagement.vue` の `startPendingComplete`、`store` の `completeTask`）。
- `completeTask`（`task.ts:407`）: `status='done'`, `completed=true`, `endedAt=now`。COMP ビューは `completedTasks`（`task.ts:242`）で `completed || status==='done'` を `endedAt` 降順表示。

### 2.4. 期限超過（overdue）
- `TaskManagement.vue:569` `isOverdue(task)`: `scheduledAt` があり未完了で `scheduledAt < now` なら true。カード/タイムラインを赤色警告表示。

### 2.5. LLM ツール `manageTasks`
- 定義: `app/src/utils/task-tools-shared.ts`（`action`/`title`/`scheduledAt`/`priority`/`categoryId`/`id`/`query`/`date`/`completed`）。
- サーバーディスパッチ: `app/src/server/routes/ws.ts` の `onToolExecute`（`ws.ts:189-250`、`add`/`search`/`update`/`delete` を `tasks-service` に橋渡し）と `onToolResult`（`ws.ts:270-289`、`task-action` イベントでクライアントへ反映。`add` かつ `scheduledAt` ありは `addSchedule`）。

### 2.6. 永続化の安全策
- `task.ts:96-163`（`loadFromLocalStorage`）: LocalStorage 即時表示 → サーバー最新取得。**「ローカルにあるがサーバーが空」= サーバー欠落とみなしローカル優先**（消失連鎖防止）。繰り返し情報はタスクオブジェクトに内包されるため、この保護対象に自動的に含まれる。

---

## 3. 設計方針（中心的な判断）

繰り返しの表現方法には 2 案がある。本仕様は **案A（ロール方式）を既定**とし、案B は §10 の選択肢として残す。

| | 案A: ロール方式（推奨） | 案B: インスタンス実体化方式 |
|---|---|---|
| 表現 | 1 タスクが繰り返しルールを持ち、`scheduledAt` を次回へ更新し続ける | テンプレートから毎回子タスクを生成 |
| 一覧表示 | 常に「次回予定」1 件だけ TODO に出る | 生成済みの各回が並ぶ |
| 完了履歴 | 完了ごとに履歴を別途記録（§5.4） | 各回が完了タスクとして自然に COMP に残る |
| 実装量 | 小（既存 `notified` 機構の延長） | 大（生成窓・重複防止・掃除が必要） |
| 相性 | 既存の単発通知/単一 `notified` と整合 | 生成タイミング管理が新規に必要 |

**採用（案A）**: 繰り返しタスクは常に「次に来る 1 回」を表す。完了・経過に応じて `scheduledAt` を次回へ繰り越し、`notified`/`completed`/`status` をリセットする。完了の事実は履歴として別途残す（§5.4）。これにより TODO 一覧が定期予定で溢れず、既存の通知機構をほぼそのまま使える。

---

## 4. 繰り返しルール（recurrence）データモデル

RFC 5545 の実用サブセット。**環境非依存の共有ユーティリティ**として次回計算を一元化する（クライアントの store/notification とサーバーの tasks-service の両方から使う。`task-tools-shared.ts` と同じ env-neutral 方針）。

- 新規ファイル: `app/src/utils/recurrence.ts`

```ts
export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;          // N周期ごと（既定 1）。例: freq='weekly', interval=2 → 隔週
  byWeekday?: number[];      // weekly 用。0=日..6=土。複数可（例: 月水金 = [1,3,5]）
  byMonthday?: number;       // monthly 用（1..31）。未指定なら anchor 日を採用。31→月末クランプ
  until?: string;            // 終了日（ISO 8601 日付）。この日時を超えたら繰り返し終了（任意）
  count?: number;            // 実施回数の上限（任意。until と併用時はどちらか先に到達で終了）
  occurrences?: number;      // 既に実施した回数（count 判定用の内部カウンタ）
}
```

`Task` への追加フィールド（`store/task.ts` の `interface Task` と `tasks-service` の生成オブジェクト双方に追加）:

```ts
recurrence?: RecurrenceRule;   // 無ければ従来どおり単発
lastCompletedAt?: string;      // 直近の1回を完了した時刻（履歴・多重繰越防止に使用）
```

- **anchor（基準日時）**: `scheduledAt` が「次回発火予定」を表す。時刻は `scheduledAt` の時分を踏襲する（別途 `time` フィールドは設けない）。
- 共有ユーティリティ API:
  - `computeNextOccurrence(rule: RecurrenceRule, from: Date): Date | null` — `from`（通常は現在の `scheduledAt`）を基準に次回日時を返す。終了条件（`until`/`count`）に達したら `null`。
  - `isRecurrenceFinished(rule, next): boolean`。
  - 月末クランプ、`byWeekday` の次曜日探索、`interval` 適用を内包。DST/TZ は `scheduledAt` の ISO オフセット（例 `+09:00`）を保持したまま日付演算する。

### 4.1. 後方互換 / マイグレーション
- 既存タスクは `recurrence` を持たない → `computeNextOccurrence` を呼ばず単発として従来動作。
- スキーマ追加のみで破壊的変更なし。`tasks.json` の未知フィールドは読み書きでそのまま保持される（`tasks-service` は spread マージ）。

---

## 5. 挙動仕様

### 5.1. 次回への繰り越し（完了トリガー・主経路）
繰り返しタスクを完了したとき、**そのタスクを DONE にして終わりにせず、次回予定へロールする**。`store/task.ts` の `completeTask`（および `toggleTask`）を拡張:

1. `recurrence` が無い → 従来どおり `completed=true, status='done', endedAt=now`（変更なし）。
2. `recurrence` がある →
   a. 完了履歴を記録（§5.4）。`lastCompletedAt = now`。
   b. `next = computeNextOccurrence(recurrence, new Date(scheduledAt))`。
   c. `next` が `null`（終了条件到達）→ 通常完了（`completed=true, status='done', endedAt=now`）。繰り返し終了。
   d. `next` あり → `scheduledAt = next.toISOString()`, `notified=false`, `completed=false`, `status='todo'`, `endedAt=undefined`。サブタスクも `todo` に戻す。`recurrence.occurrences`（あれば）を +1。

> UI では完了操作後に「次回: MM/DD HH:mm にセットしました」等のフィードアウトを出すと分かりやすい（§7）。

### 5.2. 通知（`task-notification.ts` の拡張）
既存の 10 秒ポーリングを流用。繰り返しタスクも `scheduledAt`/`notified` を持つため、**現行ロジックのまま「次回予定」の n 分前に一度通知**される。追加で必要なのは「通知後・完了されずに経過した場合の扱い」（§5.3）だけ。

- 通知文は既存踏襲（「予定の、N分前になりました。〈title〉、の時間です。」）。繰り返しであることを付記してもよい（任意）。

### 5.3. 未完了のまま予定時刻を過ぎた場合（重要な設計判断）
「完了しないまま次の周期が来た」ケースの扱い。**既定案 = ①**（`isOverdue` を活かし、取りこぼしを可視化する）。

- **① 手動繰越（既定）**: 予定時刻を過ぎても自動で次回へ進めない。`isOverdue`（赤警告）で「やり残し」を表示。ユーザーが完了 or 「スキップ（次回へ）」操作をするまで現在の回に留まる。取りこぼしに気付ける。
  - このため UI に **「スキップ（次回へ）」アクション**を用意（`skipToNextOccurrence(id)` を store に追加：完了扱いにせず §5.1 の d だけ行う。履歴には「skipped」を記録）。
- ② 自動繰越（任意設定）: `scheduledAt + K分` を過ぎたら自動で次回へロール（`notified=false` 再セット）。取りこぼしは履歴に「missed」で残す。設定で切替可能にするか否かは §10。

> 実装上の注意: 通知ポーリングで自動繰越を行う場合、`computeNextOccurrence` を繰り返し適用して「現在時刻より未来の最初の回」まで一気に進める（長期間アプリ未起動だった場合に過去回で無限ループしないよう `while (next && next <= now)` で前進、上限回数ガードを設ける）。

### 5.4. 完了履歴（COMP ビュー）
案A ではタスク本体は消えない（次回へロールする）ため、完了の事実を別途残す。**既定案 = 履歴配列**:

- `Task` に `history?: { at: string; result: 'done' | 'skipped' | 'missed' }[]` を追加、直近 N 件（例 30 件）を保持。
- COMP ビュー（`completedTasks`/`completedTasksByDate`）に「繰り返しタスクの各回の完了」も混ぜて表示するため、history を日付別に展開して仮想的な完了エントリを生成する computed を追加する。
- 代替案（軽量）: history を持たず、`lastCompletedAt` のみ。COMP には出さず「次回予定」だけ管理する。→ §10 で確定。

### 5.5. 期限超過表示
`isOverdue`（`TaskManagement.vue:569`）は変更不要（`scheduledAt < now` かつ未完了で赤）。繰り返しタスクでも「現在の回」が過ぎれば overdue になり、①方式と自然に整合する。

### 5.6. 編集・削除
- **編集**: 繰り返しルールの変更は「今後すべての回」に適用（案A は 1 タスクなので実質これのみ）。「この回だけ変更」は案A では表現できない（→ §10、必要なら例外日 `exdate`/例外時刻を将来拡張）。
- **削除**: タスク削除で繰り返しごと消える。「今回だけスキップ」は §5.3 のスキップ操作で行う（削除ではない）。

---

## 6. `manageTasks` ツールの拡張

LLM から定期予定を作れるよう、`app/src/utils/task-tools-shared.ts` の `parameters` に**フラットな繰り返しパラメータ**を追加（ネストオブジェクトより LLM が扱いやすい）。サーバー側で `RecurrenceRule` に組み立てる。

追加パラメータ（zod・案）:

| 名前 | 型 | 説明 |
|---|---|---|
| `repeat` | `z.enum(['none','daily','weekly','monthly','yearly']).optional()` | 繰り返し種別。既定/none=単発。 |
| `repeatInterval` | `z.number().int().positive().optional()` | N周期ごと（既定1）。例: 隔週=2。 |
| `repeatWeekdays` | `z.array(z.number().int().min(0).max(6)).optional()` | weekly の曜日（0=日..6=土）。 |
| `repeatUntil` | `z.string().optional()` | 終了日（ISO / YYYY-MM-DD）。 |
| `repeatCount` | `z.number().int().positive().optional()` | 実施回数上限。 |

- **description 追記**: 「『毎朝』『毎週月曜』『毎月1日』のような定期的な予定は `repeat` を指定する。`repeat` を使うときは `scheduledAt` に初回の日時を入れること。単発は `repeat` 省略。一時的な一度きり通知（N分後に通知）はタイマーであってこのツールではない」旨を明記（既存の棲み分け文言と整合）。
- **サーバーディスパッチ**（`app/src/server/routes/ws.ts` `onToolExecute` の `add`/`update`）: `repeat!=='none'` のとき `RecurrenceRule` を組み立て、`addTaskToDb`/`updateTaskInDb` に渡す。`onToolResult` の `task-action` は既存踏襲（`addSchedule` はそのまま。繰り返しでも初回は予定付き）。
- **`tasks-service`**: `TaskData`/`addTaskToDb`/`updateTaskInDb` に `recurrence` を受け渡す口を追加。生成タスクに `recurrence` を格納。
- ⚠️ **冪等ガードとの衝突**: `addTaskToDb` の重複防止ガード（`tasks-service.ts:65-70`）は `title + categoryId + scheduledAt` の一致で重複とみなす。案A（ロール方式）では同一定期予定が同時に複数作られないため実害は小さいが、案B（インスタンス実体化）を採る場合は同一 title/日時の回が「重複」判定で弾かれる恐れがある。案B 採用時はガードのキーに `recurrence`/インスタンス識別子を含めるか、ガードを回避する専用生成経路を設けること。

---

## 7. UI 要件（`TaskManagement.vue`）

既存の全面カレンダー/クロックピッカー画面（`openDatePicker`、`DatePicker`、24hクロックピッカー、`tempCalendarDate`/`calendarStep`）に**「繰り返し」設定セクション**を追加する。

- 予定日時（初回）を選んだ後、`なし / 毎日 / 毎週 / 毎月 / 毎年` のセグメント選択。
- 毎週選択時: 曜日チップ（日〜土）の複数選択。
- 間隔入力（「N 週ごと」等、任意・既定1）。
- 終了条件（任意）: 「なし / 日付指定（until） / 回数指定（count）」。
- 保存時に `taskStore.updateTask(id, { scheduledAt, recurrence })`。
- **一覧カード表示**: 繰り返しタスクに 🔁（`pi pi-replay`/`pi pi-sync` 等）バッジと「毎週 月・水」等の要約ラベルを表示。予定日時ラベル（`getScheduledDisplay`）の隣に併記。
- **完了時フィードバック**: §5.1 の繰り越し後、「次回 MM/DD(曜) HH:mm」を短時間表示。
- **スキップ操作**（§5.3①）: overdue の繰り返しカードに「次回へ」ボタンを出す（削除モードとは別）。
- タイムライン/COMP は §5.4 の履歴表示方針に合わせて調整。

---

## 8. 実装対象ファイル一覧

新規:
- `app/src/utils/recurrence.ts` — `RecurrenceRule` 型と `computeNextOccurrence` 等（env-neutral 共有）。

変更:
- `app/src/store/task.ts` — `Task` に `recurrence`/`lastCompletedAt`/`history`、`completeTask`/`toggleTask` の繰り越し分岐、`skipToNextOccurrence` 追加、COMP 用 computed 調整。
- `app/src/utils/task-notification.ts` — （②採用時のみ）自動繰越ロジック。①既定なら変更は最小（通知文の付記程度）。
- `app/src/components/TaskManagement.vue` — 繰り返し設定UI、バッジ/要約、スキップボタン、完了フィードバック。
- `app/src/utils/task-tools-shared.ts` — `repeat`/`repeatInterval`/`repeatWeekdays`/`repeatUntil`/`repeatCount` と description。
- `app/src/server/utils/tasks-service.ts` — `TaskData`/`addTaskToDb`/`updateTaskInDb` に `recurrence` 対応。
- `app/src/server/routes/ws.ts` — `onToolExecute` の add/update で recurrence 組み立て。

変更不要（確認のみ）:
- `app/electron/ipc-handlers/schedule-handler.ts` — 通知中継のみ。変更不要。
- `/api/tasks`（GET/POST）— タスクオブジェクトをそのまま透過保存するため、`recurrence` 追加で自動対応（フィールド固定でないことを確認）。

---

## 9. 受け入れ基準（Acceptance Criteria）
1. UI で「毎日 09:00」の予定を作成 → TODO に 1 件表示され、翌 09:00 の n 分前に通知が飛ぶ。
2. その予定を完了すると一覧から消えず、`scheduledAt` が翌日 09:00 に更新され、`notified` がリセットされる（次回も通知される）。
3. 「毎週 月・水・金」を作成 → 完了のたびに次の該当曜日へ正しく繰り越す（間隔・曜日探索が正しい）。
4. `repeatUntil`/`repeatCount` の終了条件に達した回を完了すると、繰り越さず通常完了して COMP に入る（`computeNextOccurrence` が null）。
5. 未完了のまま予定時刻を過ぎた繰り返しタスクは overdue（赤）表示になり、①方式では自動で次回に進まない。「次回へ（スキップ）」で繰り越せる。
6. 「毎朝7時に薬を飲むリマインドを入れて」と依頼 → `manageTasks(add, scheduledAt=..., repeat='daily')` が呼ばれ、定期予定が 1 件作られる（`tasks.json` に `recurrence` 付きで保存）。
7. 「3分後に通知して」は従来どおりタイマーで処理され、定期予定にならない（棲み分け維持）。
8. 既存の単発予定タスク（`recurrence` なし）は従来どおり動作（後方互換）。サーバー空応答でのデータ消失防止ガードが繰り返しタスクにも効く。
9. 既存テスト（`app/src/server/__tests__/*`、`app/src/store/__tests__/task.test.ts`）が緑のまま。

---

## 10. 前提・未決事項（実装前に確定）
1. **表現方式**: 案A（ロール・推奨）で確定してよいか。案B（インスタンス実体化）を採るなら生成窓・掃除の設計が別途必要。
2. **取りこぼし時**（§5.3）: ①手動繰越（既定・overdue で気付かせる）か、②自動繰越（設定で切替）か。②なら設定 UI/フラグを追加。
3. **完了履歴**（§5.4）: `history` 配列で COMP に各回を出すか、`lastCompletedAt` のみの軽量案か。
4. **「この回だけ変更/スキップ」**: 例外日（`exdate`）や個別編集を初版に含めるか（案A の制約）。
5. **序数・高度指定**: 「毎月第2月曜」「平日のみ」「祝日除外」を将来対応とするか、初版から要るか。
6. **タイムゾーン**: `scheduledAt` の ISO オフセット保持で足りるか（端末TZ変更/DST の扱い）。
7. **通知の複数回化**: 定期予定で「前日通知＋当日通知」等の多段通知を将来入れるか（初版は既存の単一 n 分前のみ）。
8. **ツールパラメータ形状**: フラット（`repeat`/`repeatWeekdays`…）でよいか、ネスト `recurrence` オブジェクトにするか（LLM 精度とのトレードオフ）。

---

## 11. 関連ファイル
- `app/src/store/task.ts` — タスク型・完了/繰り越しロジック・永続化と消失防止。
- `app/src/utils/task-notification.ts` — 予定通知の 10 秒ポーリング（発火判定・`notified`）。
- `app/src/components/TaskManagement.vue` — スケジュール設定UI・overdue 判定・完了猶予。
- `app/src/utils/task-tools-shared.ts` — `manageTasks` ツール定義（パラメータ拡張先）。
- `app/src/server/utils/tasks-service.ts` — `tasks.json` CRUD（recurrence 受け渡し）。
- `app/src/server/routes/ws.ts` — ツールディスパッチ・`task-action` 反映。
- `app/electron/ipc-handlers/schedule-handler.ts` — 通知中継（変更不要）。
- `docs/specs/widgets/task-management/task-management-spec.md` — ウィジェット本体仕様。

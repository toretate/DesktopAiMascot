# Google カレンダー × TODOウィジェット 連携 仕様・計画（土台資料）

> **本書のステータス**: 土台資料（実装前・要件確定前）。Google カレンダーの予定を TODO ウィジェットに取り込む連携機能の設計・実装契約のたたき台を定める。数値・方式には推奨（既定案）を置くが、§11 の未決事項が確定するまでは暫定。
> **前提**: 既存の Google OAuth ログイン（§2.1）と、予定付きタスク＋通知パイプライン（§2.3）を**拡張**して実装する。破壊的変更をせず、既存のローカルタスク（`source` なし）は従来どおり動くこと（後方互換）。
> **関連**: `docs/specs/widgets/task-management/task-management-spec.md`（ウィジェット本体）、`docs/specs/widgets/task-management/repeat-schedule.md`（繰り返しタスク）、`docs/specs/tools/mascot-timer-tool-spec.md`（一時通知＝別系統）、`docs/specs/firebase.md`（認証基盤の将来像）。

---

## 1. ゴール / スコープ

### 1.1. 作るもの
ユーザーの Google カレンダーの**直近の予定**を TODO ウィジェットに読み込み（インポート）、予定付きタスクとして一覧・タイムラインに表示する。取り込んだ予定は既存の通知パイプラインに乗るため、開始 n 分前にマスコットがリマインドする。

### 1.2. スコープに含む（初版 v1）
- Google カレンダーへの**読み取り専用アクセス**の認可取得（既存ログインへの Calendar スコープ追加、またはインクリメンタル認可）。
- **直近およそ3営業日分**の予定取得（取り込み窓。§4 で定義）。全期間は取らない。
- 予定 → タスクへのマッピング（`source='google-calendar'`, `externalId` 付きの予定タスクとして登録）。
- `externalId` による冪等な取り込み（再同期で重複を作らない・変更を反映する）。
- 同期トリガー：手動ボタン＋アプリ起動時＋定期ポーリング。
- 取り込みタスクのウィジェット上での識別表示（📅 バッジ・読み取り専用の示唆）。
- 認可の接続 / 解除 UI（設定パネル）。

### 1.3. スコープに含まない（非対象・将来 §12）
- **双方向同期**（ウィジェット → Google への書き戻し・予定作成/編集/削除）。v1 は Google → ウィジェットの**片方向**。
- 複数カレンダーの選択取り込み（v1 は primary のみを既定）。
- 出席者・会議リンク（Meet）・添付・場所などのリッチ情報の完全同期（v1 はタイトル＋日時が中心）。
- Google カレンダー側の繰り返しルール（RRULE）のローカル再現。v1 は `singleEvents=true` で**展開済みインスタンス**を取り込む（`repeat-schedule.md` のローカル繰り返しとは別経路・§6.3）。
- タイマー（一時通知）系統の変更（棲み分けは各仕様に従う）。

### 1.4. 「3営業日分」の意図（重要な前提）
インポート量は「直近3営業日分ぐらい」を既定とする。理由：
- ウィジェットは**近い予定に集中**するためのもので、遠い将来の予定でカードを溢れさせない。
- 取得件数・API 負荷・同期時間を抑える。
- 取りこぼし通知（§2.3 の「予定+10分でカットオフ」）と相性がよい＝近い予定だけ持てば十分。

「営業日」の扱い（土日除外の要否）や窓長のパラメータ化は §4 と §11-2 で確定する。

---

## 2. 現状の仕組み（拡張のベースライン）

新規のスケジューラ／認証基盤は原則作らず、以下の**既存経路を拡張**する。

### 2.1. Google OAuth（現状は「ログイン専用」）
- ログイン開始 `app/src/server/api/auth/login.get.ts`：`scope='openid email profile'` のみ。`response_type=code`。
- コールバック `app/src/server/api/auth/callback.get.ts`：`code` を `oauth2.googleapis.com/token` で交換し、**`id_token` のみ**を利用。⚠️ `access_token` / `refresh_token` は**取得も保存もしていない**。`access_type=offline` も指定していない。
- 検証 `app/src/server/utils/auth-service.ts`：`id_token` を JWKS で署名検証（`verifyGoogleIdToken`）。Calendar API 呼び出しには使えない。
- 環境変数：`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`（既定 `http://localhost:3000/api/auth/callback`）。
- ⚠️ **`googleapis` SDK は未導入**。Google との通信は既存どおり素の `https`/`fetch`（`auth-service.ts`, `app/electron/ipc-handlers/google-handler.ts`）で行っている。→ Calendar も**素の REST 呼び出し**で実装し、コードベース様式とバンドルサイズを維持する（§11-5）。

> ⇒ Calendar 連携には「**読み取りスコープの追加**」「**アクセストークン（＋リフレッシュトークン）の取得・保存・更新**」が新規に必要。ここが最大の作業（§10 フェーズ0）。

### 2.2. タスクのデータモデルと永続化
- クライアント：`app/src/store/task.ts` の `interface Task`（`id`, `categoryId`, `title`, `completed`, `priority`, `steps`, `order`, `createdAt`, `status`, `scheduledAt?`, `notified?`, `memo?` …）。`source`/`externalId` は**未定義**（本仕様で追加）。
- サーバー：`app/src/server/utils/tasks-service.ts` がユーザー別 `USERS_DIR/<userId>/tasks.json` に保存。`addTaskToDb` が `id`/`createdAt`/`status:'todo'`/`notified:false` を付与。
- ⚠️ **冪等ガード**（`tasks-service.ts:65-70`）：`!completed && categoryId + title + scheduledAt` 一致で重複とみなす。カレンダー再取り込みでは**タイトル/時刻が変わると別物**になり得るため、**`externalId` を第一キーにしたガード**が別途必要（§6.2）。

### 2.3. 通知パイプライン（クライアント側 10 秒ポーリング）
- `app/src/utils/task-notification.ts` の `startNotificationCheck()` が 10 秒間隔で全タスクを走査。`scheduledAt` があり未完了・未通知で「予定−`notificationMinutes` 分」〜「予定+10分」の窓に入ると発火 → `notified=true` 保存 → OS 通知＋マスコット通知＋TTS。
- ⇒ 取り込んだ予定は `scheduledAt`+`notified` を持つので、**追加実装なしでリマインドに乗る**。
- ⚠️ 「予定+10分」カットオフのため、アプリが閉じていた間の予定は通知されない（バックフィルなし）。3営業日窓の取り込みでも同じ制約（許容）。

### 2.4. 完了・期限超過・COMP
- 完了猶予 `completionGraceSeconds`（既定5秒）→ `completeTask`（`status='done'`, `completed=true`, `endedAt`）。COMP ビューは `completedTasks`。
- `isOverdue`（`TaskManagement.vue`）：`scheduledAt < now` かつ未完了で赤警告。取り込み予定にもそのまま適用。

### 2.5. 永続化の消失防止ガード
- `task.ts` `loadFromLocalStorage`：ローカル即時表示 → サーバー最新取得。「ローカルにあるがサーバー空＝欠落とみなしローカル優先」。⚠️ **同期失敗（認可切れ等）で空配列が返っても取り込み済みタスクを消さない**よう、この保護と整合させる（§6.4）。

### 2.6. LLM ツール `manageTasks`
- `app/src/utils/task-tools-shared.ts`。会話からのタスク CRUD。カレンダー取り込みとは独立だが、取り込みタスクも同じ一覧に入るため、`manageTasks` の検索/更新対象になる点に注意（§7）。

---

## 3. 設計方針（中心的な判断）

1. **片方向・読み取り専用（v1）**：Google → ウィジェット。ユーザーの実カレンダーを壊さない安全側から入る。書き戻しは §12。
2. **取り込みタスクは「Google 由来」を明示**：`source='google-calendar'` + `externalId` を持ち、通常のローカルタスクと区別。編集・削除の扱いを分ける（§6.5）。
3. **近い予定だけ**：3営業日窓（§4）。同期のたびに窓外へ出た予定は一覧から掃除する（完了済みは残す・§6.3）。
4. **既存パイプラインへ相乗り**：通知・overdue・COMP・タイムラインはそのまま流用。新規スケジューラを作らない。
5. **認可は最小権限**：`calendar.events.readonly`（または `calendar.readonly`）に限定。ログインの基本スコープは肥大化させず、**インクリメンタル認可**（後から追加同意）を推奨（§5.1）。
6. **通信は素の REST**：`googleapis` SDK を導入せず既存様式に合わせる（§11-5 で最終確認）。

---

## 4. 取り込み窓（3営業日）— 定義

同期時に Google Calendar Events API へ渡す `timeMin`/`timeMax` を次で決める。

- `timeMin = now`（過去は取り込まない。既に始まった当日予定は含める判断は §11-2）。
- `timeMax = 現在から「営業日で N 日先」の 23:59:59`（既定 **N=3**、パラメータ化）。
- **営業日の数え方**（既定案）：土・日を除外して 3 営業日先まで進める。祝日は初版では考慮しない（祝日除外は §12）。
  - 例：金曜に同期 → 金・月・火の3営業日をカバー（≒火曜末まで）。
- **簡易案（代替）**：営業日計算をせず単純に「now +（3〜5）暦日」で固定窓にする。実装が軽く、土日跨ぎの体感差も小さい。→ どちらを採るかは §11-2。
- API パラメータ：`singleEvents=true`（繰り返しを実体化）, `orderBy=startTime`, `maxResults`（安全上限、例 100）, `timeMin`/`timeMax`（RFC3339）, `timeZone`（端末 TZ）。

> 窓長・営業日除外・当日の開始済み予定の扱いは、いずれも設定化しやすいよう1か所（共有ユーティリティ）に閉じる。

---

## 5. 認可（OAuth）拡張設計

### 5.1. スコープと同意フロー（推奨＝インクリメンタル認可）
- 追加スコープ：`https://www.googleapis.com/auth/calendar.events.readonly`（予定の閲覧のみ。より広い `calendar.readonly` との選択は §11-1）。
- **推奨**：基本ログイン（`openid email profile`）とは**別の同意フロー**で Calendar スコープを後から要求（`include_granted_scopes=true`）。カレンダー未使用ユーザーに閲覧同意を強制しない。
  - 代替：ログインのスコープに最初から含める（実装は単純だが同意画面が重くなる）。
- リフレッシュトークン取得のため：`access_type=offline` ＋（再同意を確実にするなら）`prompt=consent`。

### 5.2. トークンの取得・保存・更新
- コールバックで `access_token` / `refresh_token` / `expiry` を受領（現状は `id_token` のみ利用のため**受領処理の追加が必要**）。
- 保存先（要決定 §11-3）：
  - 案A（推奨・サーバ集約）：`USERS_DIR/<userId>/google-tokens.json`（tasks.json と同じユーザーディレクトリ）にサーバー側保存。同期もサーバーで実行しトークンをクライアントに出さない。
  - 案B（Electron 保存）：`safeStorage` で暗号化してローカル保存し、Electron main（`google-handler.ts` 拡張）が同期。デスクトップ完結・オフライン耐性。
- `refresh_token` で `access_token` を自動更新（`oauth2.googleapis.com/token`, `grant_type=refresh_token`）。401/`invalid_grant` 時は「再接続が必要」を UI に通知。
- ⚠️ **セキュリティ**：`GOOGLE_CLIENT_SECRET` はサーバー/ main プロセスのみ。トークンは平文でレンダラに置かない。

### 5.3. 同期の実行場所（要決定 §11-4）
- 案A：サーバールート（例 `GET /api/calendar/sync`）でトークン保持＋取得＋マッピングし、`tasks-service` に反映。ツールディスパッチ（`ws.ts`）や既存 API と同居。
- 案B：Electron main の IPC ハンドラ（`google-handler.ts` に `sync-google-calendar` を追加）で取得し、結果をクライアントへ。既存の Google 通信が main にある様式と一致。

---

## 6. 挙動仕様

### 6.1. 予定 → タスク マッピング
| Google イベント | Task フィールド | 備考 |
|---|---|---|
| `id` | `externalId` | 冪等キー。`recurringEventId`+`start` でも一意（展開後インスタンス） |
| `etag` | `externalEtag?` | 変更検知に利用（任意） |
| `summary` | `title` | 空なら「(タイトルなし)」等の既定 |
| `start.dateTime` | `scheduledAt` | ISO 8601＋オフセット保持（`+09:00`）。既存 §2.3 と同形式 |
| `start.date`（終日） | `scheduledAt` | 終日イベントの扱いは §6.6 |
| `htmlLink` | `memo` 等（任意） | v1 は必須でない |
| （固定） | `source='google-calendar'` | ローカルと区別 |
| （固定） | `categoryId` | 取り込み専用カテゴリ（例 `gcal`「Calendar」）を用意。§11-6 |
| （固定） | `priority='normal'` | 既定 |

- `Task` への追加フィールド（`store/task.ts` と `tasks-service` 双方）：
```ts
source?: 'local' | 'google-calendar';   // 無ければ 'local' 扱い（後方互換）
externalId?: string;                     // Google イベント/インスタンスの一意 ID
externalEtag?: string;                   // 変更検知（任意）
calendarId?: string;                     // 取得元カレンダー（将来の複数対応用・任意）
readOnly?: boolean;                      // true=ウィジェット上で編集不可の示唆
```

### 6.2. 冪等な取り込み（再同期の反映）
- マッチングの第一キーは **`externalId`**（既存 title/日時ガードとは別経路）。
- 既存に同一 `externalId` が有る → **更新**（`title`/`scheduledAt` 差分を反映）。ただし**ユーザーのローカル状態（`completed`/`status`/`endedAt`/`notified`/`order`）は保持**（上書きしない）。
- 無い → **新規追加**。⚠️ `addTaskToDb` の冪等ガードは `externalId` を見ないため、取り込み専用の生成経路（`externalId` 一致で重複判定）を設けるか、ガードにキーを追加する。
- `etag` 未変更ならスキップして書き込み負荷を抑える（任意最適化）。

### 6.3. 窓外・削除された予定の掃除
- 同期のたびに「今回の取得結果に含まれない `source='google-calendar'` タスク」を検出：
  - **未完了**で窓外/削除 → 一覧から**除去**（Google 側が正）。
  - **完了済み（COMP）** → **残す**（実施履歴として保持）。掃除で消さない。
- ⚠️ 取得が **0件かつ API がエラー/認可切れ** の場合は**掃除しない**（消失防止・§6.4）。「正常に0件」と「取得失敗」を区別する（HTTP ステータス/例外で判定）。

### 6.4. 消失防止（既存ガードとの整合）
- 同期失敗（ネットワーク/401/`invalid_grant`）時は既存タスクへ一切の削除・上書きを行わず、UI に「同期できませんでした／再接続してください」を出すのみ。
- `task.ts` の「サーバー空＝ローカル優先」ガード（§2.5）と矛盾しないよう、掃除は**同期成功が確定した結果**に対してのみ適用。

### 6.5. 編集・削除・完了の扱い
- **完了**：取り込みタスクもローカルで完了可能（DOING→DONE 猶予も同じ）。完了状態は再同期で保持（§6.2）。v1 は Google への書き戻しなし。
- **編集**：`readOnly=true` の示唆により、タイトル/日時の直接編集は基本不可（Google が真実源）。メモやローカルなサブタスク付与は許容してよい（§11-7）。
- **削除**：ウィジェットからの削除は「今回の一覧から隠す」ローカル操作に留め、次回同期で復活し得ることを UI で示す（もしくは削除不可）。Google 側は消さない。

### 6.6. 終日イベント（`start.date`）
- 既定案：`scheduledAt` を当日の既定時刻（例 09:00 端末TZ）にマップし、`allDay?:true`（任意フィールド）で終日を示す。通知はデフォルト時刻基準。
- 代替：終日は取り込むが通知対象外にする。→ §11-8。

### 6.7. 同期トリガー / 頻度
- **手動**：設定または widget ヘッダーの「今すぐ同期」ボタン。
- **起動時**：アプリ/ウィジェット初期化時に1回（認可済みのとき）。
- **定期**：一定間隔（例 10〜15分）でバックグラウンド同期。10秒通知ポーリングとは別タイマー。
- 差分効率化：将来 `syncToken`（増分同期）を導入可能（v1 は窓の全件取得で十分・§12）。

---

## 7. LLM ツール `manageTasks` との関係
- 取り込みタスクも同じ `tasks.json`/一覧に入るため、`manageTasks` の `search`/`update`/`delete` の対象になり得る。
- v1 方針：`manageTasks` から**カレンダー由来タスクの日時変更・削除は行わせない**（`source='google-calendar'` は読み取り前提）。会話で「予定を変えて」と言われた場合はカレンダー側操作が必要＝将来の双方向連携（§12）である旨を description に追記するか、対象外としてガードする。
- 会話で「明日の予定を教えて」→ 取り込み済みタスクを `search` で答えるのは有用（読み取りは許容）。

---

## 8. UI 要件
- **接続 UI**：設定パネル（`ChatGenSettingsPanel.vue` 近辺 or 専用セクション）に「Google カレンダーと連携」ボタン、接続状態（メール/最終同期時刻）、解除ボタン。
- **同期状態**：`同期中… / 最終同期 HH:mm / 失敗（再接続）` の表示。
- **カード表示**：`source='google-calendar'` のタスクに 📅 バッジ（Google カラー等）と読み取り専用の視覚示唆。予定日時ラベル（`getScheduledDisplay`）の隣に併記。
- **手動同期**：widget ヘッダーに「更新（同期）」アクション。
- タイムライン/TODO/COMP は既存ビューをそのまま利用（取り込みタスクは `scheduledAt` を持つので TIMELINE と親和）。
- カテゴリ：取り込み専用カテゴリ（`gcal`「Calendar」）をタブに追加、または ALL に混在（§11-6）。

---

## 9. 実装対象ファイル一覧（想定）
新規：
- 認可拡張：`app/src/server/api/auth/`（Calendar 用の login/callback、またはインクリメンタル同意ルート）。
- トークン保存：`app/src/server/utils/google-token-service.ts`（案A採用時。取得/保存/更新）。
- 同期本体：`app/src/server/api/calendar/sync.get.ts`（案A）または `app/electron/ipc-handlers/google-handler.ts` に `sync-google-calendar` 追加（案B）。
- マッピング/窓計算の共有ユーティリティ：`app/src/utils/gcal-mapping.ts`（3営業日窓計算・event→Task 変換・env-neutral）。

変更：
- `app/src/store/task.ts` — `Task` に `source`/`externalId`/`externalEtag`/`calendarId`/`readOnly`（+終日フラグ）、取り込みマージ用アクション（`upsertImportedTasks`, 掃除ロジック）、消失防止との整合。
- `app/src/server/utils/tasks-service.ts` — `externalId` を第一キーにした upsert/掃除 API、`TaskData` 拡張。冪等ガードとの整合。
- `app/src/components/TaskManagement.vue` — バッジ/読み取り専用示唆、同期ボタン、接続状態、カテゴリ表示。
- `app/src/store/config.ts` — 連携 ON/OFF・最終同期時刻・窓長 N・カレンダー選択などの設定。
- `app/src/server/api/auth/login.get.ts` / `callback.get.ts` — スコープ追加 or 別フロー、トークン受領（採用案により）。
- （案B時）`app/electron/preload.ts` / `electron.d.ts` — IPC 型追加。

変更不要（確認のみ）：
- `app/src/utils/task-notification.ts` — 取り込みタスクは既存ロジックで通知される。原則変更なし（終日通知方針次第で微修正・§6.6）。

---

## 10. 実装フェーズ計画（たたき台）
- **フェーズ0（最重要・認可基盤）**：Calendar スコープ追加、`access_token`/`refresh_token` の取得・保存・更新、再接続 UI。ここが成立しないと後段が動かない。
- **フェーズ1（片方向取り込み MVP）**：3営業日窓の取得 → `event→Task` マッピング → `externalId` 冪等 upsert → 手動同期ボタン。通知は既存パイプラインに相乗り。
- **フェーズ2（運用）**：起動時＋定期同期、窓外/削除の掃除（完了は保持）、同期状態 UI、カード 📅 バッジ、消失防止の作り込み。
- **フェーズ3（将来 §12）**：複数カレンダー選択、増分同期（`syncToken`）、終日/祝日の高度化、双方向（書き戻し）。

---

## 11. 未決事項（実装前に確定）
1. **スコープ**：`calendar.events.readonly`（予定のみ）か `calendar.readonly`（カレンダー一覧含む）か。複数カレンダー将来対応なら後者。
2. **取り込み窓**：営業日計算で「3営業日」か、単純な暦日固定（例 +5日）か。当日の**開始済み予定**を含めるか。窓長 N は設定可能にするか。
3. **トークン保存**：案A（サーバ集約 `USERS_DIR/<userId>/google-tokens.json`）か案B（Electron `safeStorage`）か。
4. **同期実行場所**：案A（サーバールート）か案B（Electron main IPC）か。§5.3。
5. **HTTP クライアント**：素の `fetch`/`https`（既存様式・推奨）か `googleapis` SDK 導入か。
6. **カテゴリ**：取り込み専用カテゴリ `gcal`「Calendar」を作るか、既存カテゴリに割り当てるか、ALL 混在か。
7. **編集許容範囲**：取り込みタスクにメモ/サブタスク付与を許すか、完全読み取り専用にするか。
8. **終日イベント**：既定時刻へマップして通知対象にするか、通知対象外にするか、取り込まないか。
9. **削除操作の意味**：ウィジェット削除を「今回だけ非表示（次回復活）」にするか、削除不可にするか。
10. **`manageTasks` ガード**：カレンダー由来タスクへの更新/削除をツールから禁止するか（推奨）、条件付き許可か。
11. **プライバシー同意**：予定タイトル等を取り込む旨のユーザー説明・オプトイン文言（初回同意時に明示）。

---

## 12. 将来拡張
- **双方向同期**：ウィジェット → Google への予定作成/編集/完了反映（`calendar.events` 書き込みスコープ）。
- **増分同期（`syncToken`）**：全件取得をやめ差分のみ取得。
- **複数カレンダー**：カレンダー一覧取得＋選択、色/名前でのカテゴリ・マッピング。
- **祝日除外・営業日計算の高度化**、`repeat-schedule.md`（ローカル繰り返し）との統合方針の整理（Google 展開インスタンス vs ローカル RRULE の棲み分け）。
- 会議リンク（Meet）・場所・出席者などのリッチ表示、開始前のワンタップ参加。

---

## 13. 関連ファイル
- `app/src/store/task.ts` — タスク型・完了/永続化・消失防止（`source`/`externalId` 追加先）。
- `app/src/server/utils/tasks-service.ts` — `tasks.json` CRUD（`externalId` upsert/掃除の追加先）。
- `app/src/utils/task-notification.ts` — 予定通知の 10 秒ポーリング（取り込み予定が相乗り）。
- `app/src/components/TaskManagement.vue` — 一覧/タイムライン UI（バッジ・同期ボタン）。
- `app/src/server/api/auth/login.get.ts` / `callback.get.ts` — OAuth 開始/コールバック（スコープ・トークン受領の拡張先）。
- `app/src/server/utils/auth-service.ts` — Google トークン検証（同様式で Calendar REST を実装）。
- `app/electron/ipc-handlers/google-handler.ts` — Google 通信の既存様式（案B の同期実装先）。
- `app/src/utils/task-tools-shared.ts` — `manageTasks` 定義（取り込みタスクとの関係・ガード）。
- `docs/specs/widgets/task-management/task-management-spec.md` / `repeat-schedule.md` — ウィジェット本体・ローカル繰り返し仕様。

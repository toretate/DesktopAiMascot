# メモウィジェット（Memo / Sticky Notes）仕様書 — 土台

> **本書のステータス**: 土台（ドラフト）。既存の「タスク管理ウィジェット」のアーキテクチャを踏襲する前提で、実装に必要な骨子・識別子・棲み分け・受け入れ基準を先に固める。詳細UI/演出は §10 の未決事項を確定してから追記する。
> **対象読者**: 本リポジトリを実装する別AI（および人間の実装者）。
> **正典**: 識別子・パス・localStorage キー・イベント名は本書の記載を暫定の正とする（未決は §10）。

---

## 1. ゴール / スコープ

### 1.1. 作るもの
チャットと並行して表示できる、独立フローティング型の**自由記述メモ（付箋）ウィジェット**。ユーザーが思いついたことを素早く書き留め、後から一覧・編集・削除できる。タスク管理ウィジェットと同じウィンドウ制御（統合ウィンドウ内フローティング / 分離 Electron ウィンドウ）に従う。

### 1.2. スコープに含む
- フローティング型メモウィジェット本体（統合／分離の両モード対応）。
- メモの追加・編集・削除・並べ替え（CRUD）と一覧表示。
- 位置・表示状態の永続化（localStorage）とサーバー側 `memos.json` への保存。
- チャットヘッダーからの表示トグル。
- LLM ツール `manageMemos`（会話からメモを追加・検索・更新・削除）。

### 1.3. スコープに含まない（非対象・現時点）
- 期限・通知・リマインド（それは manageTasks / タイマーの担当。§2 参照）。
- リッチテキスト、画像添付、共有・同期（将来検討）。
- タスクとメモの相互変換（将来検討・§10）。

---

## 2. 既存機能との棲み分け（重要）

「書き留める／思い出す」系には既に **2 系統** が存在する。メモは **3 つ目**で、役割が異なる。混同しないこと。

| | メモ（本ウィジェット） | manageTasks（永続タスク/予定） | マスコットタイマー（一時通知） |
|---|---|---|---|
| 目的 | 期限のない自由メモ・覚え書き | 一覧管理する TODO・予定 | その場限りの一度きり通知 |
| 時間軸 | なし | 予定日時（任意）・完了状態あり | 相対秒後に一度発火 |
| 永続化 | する（`memos.json`） | する（`tasks.json`） | しない |
| 代表依頼 | 「これメモっといて」「買い物リストに牛乳」 | 「明日15時に会議」「レポートを書く」 | 「3分後に通知して」 |
| ツール | `manageMemos` | `manageTasks` | `setMascotTimer`（タグ/ツール） |

> ⚠️ 命名衝突の注意: 既存のタイマー通知ペイロードにも `memo`（`timer-trigger` の `{ memo: string }`）という語が使われている。**本ウィジェットの「メモ」とは無関係**。本仕様の識別子は `Memo` / `manageMemos` / `memos.json` に統一し、タイマーの `memo` フィールドには手を加えない。関連: `docs/specs/tools/mascot-timer-tool-spec.md`。

---

## 3. 機能・配置要件（タスクウィジェットに準拠）

参照実装: `app/src/components/TaskManagement.vue`。メモウィジェットは同等のウィンドウ制御ロジックをそのまま踏襲する。

### 3.1. ウィンドウモードに応じた移動制御
- **分離ウィンドウモード（split / compact 相当）**: デスクトップ上に独立した透過 Electron ウィンドウ（ハッシュ: `#memo`）として起動。ウィンドウ全体を自由にドラッグ移動可能。
- **統合ウィンドウモード（integrated）**: `IntegratedLayout` 内のフローティングUI（最前面レイヤー、`position:absolute` + `zIndex:100`）として描画。統合ウィンドウのエリア内限定で自由にドラッグ移動可能。
- **compact モード**: `ChatPanel` 内でフルスクリーンスワップ表示（タスクウィジェットと同じ扱い）。

### 3.2. 移動ハンドラ（ドラッグエリア）
- ウィジェット最上部ヘッダーをマウスでドラッグして移動。ボタン/入力欄上でのドラッグは抑止する。
- **Electron 独立窓**: `window.electronAPI.dragWindow({ dx, dy, isStart/isEnd })` を呼びデスクトップ上のウィンドウ位置を動かす。
- **統合ウィンドウ内**: ドラッグ時にウィジェット自身の `absolute` 座標（`posX`, `posY`）をビューポートクランプ付きで動的更新。

### 3.3. 表示の開閉制御（トグル）
- チャットパネルのヘッダー（`app/src/components/chatpanel/ChatHeader.vue`）に**メモトグルボタン**（付箋/メモアイコン）を追加。
- **分離モード**: トグルで独立メモウィンドウの show/hide を Electron 経由（`toggle-memo-window`）で制御。
- **統合/ compact モード**: トグルで描画フラグ `showMemoWidget` を切り替え。
- `ChatPanel.vue` は `v-model:showMemoManagement` で受け、`showMemoWidget`（ストア）と双方向同期する（タスクの `showTaskManagement` と同一パターン）。

### 3.4. 位置・表示状態の保存/復元（localStorage）
- 統合モードのドラッグ完了時（`mouseup`）に座標を保存。キー: **`memo_widget_pos_x`**, **`memo_widget_pos_y`**。
- マウント時に保存位置を復元。初期既定は右上寄せ（例: `posX = innerWidth - 400`, `posY = 80`）。
- 表示フラグ `showMemoWidget` は **`desktop-mascot-show-memo-widget`** に永続化。

### 3.5. メモ一覧・操作
- メインスクロールエリアにメモカードを縦並び表示。新しい順／手動並べ替え（ドラッグ）に対応。
- 各カード: 本文（複数行）、更新日時、（任意で）色・ピン留め。
- **編集**: カードをクリック/タップでインライン編集（テキストエリア）。
- **削除**: 誤削除防止のため、タスクウィジェットの「削除モード」に倣うか、カードごとの確認ダイアログとする（§10 で確定）。
- **新規追加**: 最下部固定フォーム（テキスト入力 + 追加ボタン）。空文字は追加不可（trim 後）。

---

## 4. データモデル / 永続化

### 4.1. サーバー側（`app/src/server/utils/memos-service.ts` を新規作成）
- 保存先: `path.join(USERS_DIR, userId, 'memos.json')`（`tasks-service.ts` の `getUserTasksPath` と同型）。
- 書き込みは `safeWriteFileSync` + `JSON.stringify(data, null, 4)`（`tasks-service.ts` と同じ安全書き込み）。
- 既定データ形状:

```jsonc
{
  "memos": [
    {
      "id": "memo_xxxxxxxxx",     // 'memo_' + rand（tasks の 'task_' に倣う）
      "content": "牛乳を買う",     // 本文（必須・trim 済み）
      "color": "yellow",          // 任意（未決: 色の集合）
      "pinned": false,             // 任意
      "order": 0,
      "createdAt": "2026-07-09T12:00:00+09:00",
      "updatedAt": "2026-07-09T12:00:00+09:00"
    }
  ]
}
```

- 公開 API（`tasks-service.ts` に対応させる）:
  - `addMemoToDb(userId, { content, color?, pinned? })` — ディレクトリ生成 → 読み込み/マージ → 冪等ガード（同一 `content` の重複追加を無視、tasks の重複ガードに倣う）→ 追加 → 保存 → `{ memo }` を返す。
  - `searchMemosFromDb(userId, query?)` — `content` 部分一致で絞り込み。
  - `updateMemoInDb(userId, id, { content?, color?, pinned? })` — 対象更新、`updatedAt` を更新。無ければ throw。
  - `deleteMemoFromDb(userId, id)` — id で除去、無ければ throw。

### 4.2. クライアント側ストア（`app/src/store/memo.ts` を新規作成）
- `task.ts` に倣った Pinia ストア。`showMemoWidget: Ref<boolean>` と メモ配列を保持。
- localStorage キー: `desktop-mascot-memos`（データ）, `desktop-mascot-show-memo-widget`（表示フラグ）。
- **消失対策**: `tasks-persistence-safety` と同様に、サーバー空応答での上書き消失を防ぐガードを設けること（localStorage + サーバー二重保存の整合）。

---

## 5. LLM ツール `manageMemos`（実装契約）

`@lmstudio/sdk` の `tool({...})` + zod で定義し、`app/src/utils/memo-tools-shared.ts` に環境非依存で置く（`task-tools-shared.ts` と同型）。`implementation` はスタブ（引数を JSON エコー）とし、実処理はサーバー側ディスパッチ（`ws.ts` の `onToolExecute`、`manageTasks` と同一パターン）で `memos-service.ts` を呼ぶ。

- **name**: `manageMemos`
- **description（骨子）**: 「期限のない自由メモ・覚え書きの追加・検索・更新・削除を行う。買い物リストや思いつき等、後から一覧で見返したいがスケジュール管理の不要なものに使う。期限付きの予定/TODO は `manageTasks`、その場限りの一度きり通知はタイマーを使うこと（混同しない）。」
- **parameters（zod・案）**:

| 名前 | 型 | 必須 | 説明 |
|---|---|---|---|
| `action` | `z.enum(['add','search','update','delete'])` | ✅ | 操作種別。 |
| `content` | `z.string().optional()` | add 時必須 | メモ本文。 |
| `id` | `z.string().optional()` | update/delete 時必須 | 対象メモID。 |
| `query` | `z.string().optional()` | | 本文の検索キーワード（search 時）。 |
| `color` | `z.string().optional()` | | 付箋色（任意・§10）。 |
| `pinned` | `z.boolean().optional()` | | ピン留め（任意）。 |

- **戻り値**: 成功 `{ "success": true, ... }` / 失敗 `{ "success": false, "error": "<理由>" }`（例外は投げない）。
- **登録**: `app/src/server/skills/tool-use/manage-memos-tool.ts`（`memo-tools-shared` の re-export）を作り、`app/src/server/skills/tool-use/index.ts` の `lmStudioTools` 配列に追加。
- **一覧反映**: メモ追加/更新時にクライアントへ反映するイベント（`task-action` に相当する `memo-action` 等）を送るか、既存経路を流用するかは §10 で確定。

---

## 6. UI・デザイン要件（骨子）
- タスクウィジェットと視覚的トーンを揃えつつ、「付箋」らしさを出す。
- **配色**: カード = 付箋色（黄/ピンク/青/緑 等、既定は黄）。背景・角丸・影はタスクウィジェット（背景 `#f1f5f9`、カード角丸 `12px`、`shadow-sm`）に準拠。
- **レイアウト順序**:
  1. ヘッダー（ドラッグ移動領域）: 「MEMO」タイトル、閉じるボタン、（任意で）削除モードスイッチ。
  2. メインスクロールエリア: メモカード一覧（ピン留めを上部固定）。
  3. 最下部固定フォーム: 本文入力 + 追加ボタン。
- ※ 具体的なマークアップ/クラス設計は本ウィジェット実装時に確定。プレビュー画像は追って追加。

---

## 7. 実装対象ファイル一覧（新規/変更）

新規:
- `app/src/components/Memo.vue` — ウィジェット本体（`TaskManagement.vue` の window-mode/drag/resize ロジックを踏襲）。
- `app/src/store/memo.ts` — Pinia ストア（`showMemoWidget` + メモ配列 + 永続化）。
- `app/electron/window/memo-window.ts` — `#memo` を読み込む透過ウィンドウ + `toggleMemoWindow()`（`task-window.ts` を複製・改名）。
- `app/src/server/utils/memos-service.ts` — `memos.json` の CRUD。
- `app/src/utils/memo-tools-shared.ts` — `manageMemos` ツール定義。
- `app/src/server/skills/tool-use/manage-memos-tool.ts` — 上記の re-export。

変更:
- `app/electron/main.ts` — `initMemoWindow`/`toggleMemoWindow` の import と IPC `toggle-memo-window` ハンドラ追加。
- `app/electron/preload.ts` — `toggleMemo: () => ipcRenderer.send('toggle-memo-window')` を公開。
- `app/src/electron.d.ts` — `toggleMemo: () => void;` の型追加。
- `app/src/app.vue` — `currentHash === '#memo'` で `<Memo />` を単体描画するルート追加。
- `app/src/components/layouts/IntegratedLayout.vue` — `<Memo v-if="showMemoWidget" />` を最前面レイヤーに追加。
- `app/src/components/ChatPanel.vue` — `showMemoManagement` ローカル ref + ストア同期 watcher、compact モードのフルスクリーンスワップ追加。
- `app/src/components/chatpanel/ChatHeader.vue` — メモトグルボタン + `v-model:showMemoManagement` 追加。
- `app/src/server/routes/ws.ts` — `onToolExecute` に `manageMemos` 分岐追加（`memos-service.ts` を呼ぶ）。
- `app/src/server/skills/tool-use/index.ts` — `lmStudioTools` に `manageMemosTool` を追加。

---

## 8. 受け入れ基準（Acceptance Criteria・骨子）
1. チャットヘッダーのメモトグルで、統合モードではフローティング表示/非表示、分離モードでは独立メモウィンドウ（`#memo`）の show/hide が切り替わる。
2. 統合モードでヘッダーをドラッグしてウィジェットを移動でき、位置が `memo_widget_pos_x/y` に保存・リロード後も復元される。
3. メモの追加・編集・削除・並べ替えが UI から行え、`memos.json` と localStorage の双方に反映される。空文字メモは追加できない。
4. 「これメモっといて」等の依頼で `manageMemos(add)` が呼ばれ、メモ一覧に追加される。**タスク一覧（`tasks.json`）は増えない**。
5. 「明日15時に会議」等の期限付き依頼では `manageMemos` を呼ばず `manageTasks(add)` が呼ばれる。「3分後に通知」ではメモもタスクも作らずタイマーが動く（3系統の棲み分け）。
6. サーバー空応答等でメモが消失しない（消失対策ガードが機能する）。
7. 既存テスト（`app/src/server/__tests__/*`, `app/src/store/__tests__/*`）が緑のまま。

---

## 9. テスト観点（骨子）
- **単体（サーバー）**: `addMemoToDb`/`searchMemosFromDb`/`updateMemoInDb`/`deleteMemoFromDb` の CRUD・冪等ガード・not-found throw（`tasks-service.test.ts` に倣う）。
- **単体（ディスパッチ）**: `onToolExecute('manageMemos', args)` の戻り値（成功/バリデーション失敗）。`manageMemos` 実行時に `manageTasks` 側の永続化が起きないこと。
- **ストア**: 消失対策ガード（空応答で既存メモが消えない）。
- **ルーティング（任意）**: 代表プロンプトでメモ/タスク/タイマーが正しく選ばれるか。

---

## 10. 前提・未決事項（実装前に確定）
1. **命名**: コンポーネント名は `Memo.vue` か `MemoWidget.vue` か。ツール名 `manageMemos` で確定してよいか。
2. **付箋の属性**: `color`（色の集合と既定）と `pinned`（ピン留め）を初版に含めるか、本文のみの最小実装から始めるか。
3. **削除方式**: タスクの「削除モード」踏襲か、カードごとの確認ダイアログか。
4. **一覧反映イベント**: `manageMemos` によるサーバー側変更をクライアントへ反映する仕組み（新規 `memo-action` イベント新設 or 既存経路流用）。
5. **タスク↔メモ変換**: 「このメモをタスクにする」導線を将来入れるか（初版は非対象の想定）。
6. **有効/無効フラグ**: `manageMemos` を設定でオフにできるようにするか（既定: 常時有効）。
7. **プレビュー画像**: UI 確定後に `docs/specs/widgets/memo/memo-preview.png` を追加するか。

---

## 11. 関連ファイル / ドキュメント
- `docs/specs/widgets/task-management/task-management-spec.md` — 踏襲元のウィジェット仕様。
- `docs/specs/tools/mascot-timer-tool-spec.md` — タイマー（棲み分けの相手方）。
- `app/src/components/TaskManagement.vue` — window-mode/drag/resize の参照実装。
- `app/electron/window/task-window.ts` — 分離ウィンドウ生成の参照実装（`#tasks`）。
- `app/src/store/task.ts` — ストア/永続化の参照実装。
- `app/src/server/utils/tasks-service.ts` — サーバー CRUD の参照実装。
- `app/src/utils/task-tools-shared.ts` — ツール定義の参照実装。
- `app/src/components/chatpanel/ChatHeader.vue`, `app/src/components/ChatPanel.vue`, `app/src/components/layouts/IntegratedLayout.vue` — トグル/描画の配線先。

# VOICEVOX 疎通確認および話者スタイル選択機能の実装計画

ローカル音声合成サーバー VOICEVOX 設定において、接続テスト（疎通確認）ボタンと成功・失敗インジケータ（チェックマーク/赤×）を追加します。
また、疎通成功時にサーバーからスタイル一覧（ボイスモデル）を取得してセレクトボックスから選択できるようにし、チャット音声再生時にその話者IDとエンドポイントを適用するように連携します。

## ユーザーレビュー要求事項

> [!NOTE]
> - 疎通成功時は、緑色のチェックマーク（`pi-check-circle`）と成功した旨を表示します。
> - 疎通失敗時は、赤色のバツマーク（`pi-times-circle`）とエラー理由を表示します。
> - 再試行用の再読み込みボタンを設置し、キャラクターごとの各スタイルのスタイル名（例: 「四国めたん (ノーマル)」）を Select から選べるようにします。
> - リストが読み込めていない場合のフォールバックとして、手動で話者ID（数字）を入力できるように配慮します。

## オープンクエスチョン

特になし。

---

## 提案される変更

### メインプロセス & IPC通信

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
- `synthesize-voicevox` ハンドラーの引数に `endpoint` を追加し、動的に指定されたURLに対してクエリ作成と合成を行うように拡張します。
- `get-voicevox-speakers` ハンドラーを新規実装し、`/speakers` エンドポイントから話者とスタイルのネスト構造を取得、フラットな `{ name, value }` 形式に成形して返します。

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts) / [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)
- ブリッジメソッド `getVoicevoxSpeakers` を追加公開し、`synthesizeVoicevox` メソッドのシグニチャを拡張します。

---

### フロントエンド（Vue.js）

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)
- 接続検証と話者ロード用の状態変数を追加：
    - `voicevoxEndpoint` (エンドポイント)
    - `voicevoxSpeaker` (選択話者ID)
    - `isTestingVoicevox` (ロード中フラグ)
    - `voicevoxConnectionState` (`'idle' | 'success' | 'failed'`)
    - `voicevoxConnectionErrorMsg`
    - `voicevoxSpeakers` (取得スタイルリスト)
- `testVoicevoxConnection` メソッド、および表示用 Computed プロパティ（`voicevoxConnectionClass` 等）を追加します。
- マウント時、音声エンジンが `voicevox` なら自動で接続確認を実行する処理を `onMounted` に追加。
- `saveSettings` にて `voicevoxEndpoint` と `voicevoxSpeaker` を `localStorage` に保存します。
- **HTMLの調整**:
    - VOICEVOX 選択時に「VOICEVOX エンドポイント」入力フォームと「疎通・再読み込み同期ボタン」を配置。
    - 接続状況を表示するチェック/バツ付きステータスボックスを配置。
    - 取得できた話者スタイルをドロップダウン（`Select`）から選べるようにし、未ロード時は `InputText`（ID手動入力）にフォールバック。

#### [MODIFY] [ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/ChatPanel.vue)
- 音声再生処理時に `localStorage` から `voicevoxSpeaker` と `voicevoxEndpoint` を取得し、それらを `synthesizeVoicevox` に引数として渡すように修正します。

---

## 検証計画

### 修正内容のビルド検証
- `cmd.exe /c npm run build` を実行し、ビルドや型エラーが発生しないことを確認します。

### 手動検証
- 設定画面を単体起動し、「音声AI」で VOICEVOX を選択。
- **接続失敗テスト**: 存在しないエンドポイント（例: `http://localhost:59999`）で同期ボタンをクリックし、赤いバツマークとエラーが表示され、話者指定が数値入力ボックスになることを確認します。
- **接続成功テスト**: 正常なモックまたは実サーバーにて同期ボタンをクリックし、緑のチェックマークとロードされたスタイル数が出現し、話者プルダウンから「ずんだもん」などを選択できることを確認します。
- 「設定を保存」をクリックし値が保持されることを確認。
- 通常起動してチャットを行い、選択したボイススタイルで音声が再生されることを検証します。

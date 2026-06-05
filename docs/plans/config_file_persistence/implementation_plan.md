# アプリケーション設定のローカルファイル永続化への移行計画

現在ブラウザの `localStorage` のみに保存されていた各種設定データ（AIエンジン選択、APIキー、各エンジンごとのモデル名、LM Studio や VOICEVOX のエンドポイント、話者IDなど）を、メインプロセスが管理するローカル設定ファイル（`config.json`）に完全永続化し、再起動時やデバッグ起動時にも設定が完全に保持されるように移行します。

## ユーザーレビュー要求事項

> [!NOTE]
> Webブラウザ上でのモック開発環境の利便性を維持するため、メインプロセスとの通信（`window.electronAPI`）が利用できない場合は、自動的に `localStorage` をフォールバックとして使用し続けるように二重化処理を行います。

## オープンクエスチョン

特になし。

---

## 提案される変更

### メインプロセスの設定ファイル定義の拡張

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
- `ConfigData` インターフェースを拡張し、以下の変数を登録します：
    - `selectedEngine`, `temperature`, `googleAiStudioApiKey`
    - `geminiModel`, `openaiModel`, `anthropicModel`
    - `lmstudioEndpoint`, `lmstudioModel`
    - `selectedVoiceEngine`, `voicevoxEndpoint`, `voicevoxSpeaker`
    - `selectedImageEngine`, `selectedVideoEngine`
- `AppConfig` の `load()` メソッド内に、上記パラメータのデフォルト値を定義します（これにより、設定ファイルが存在しない場合もデフォルト値から自動生成されます）。
- フロントエンドと同期をとるために、以下の新しい IPC ハンドラーを追加します：
    - `get-app-config` (ファイルから現在の設定情報をロードして返却)
    - `update-app-config` (渡された設定値でファイルを安全に書き換え・セーブ)

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts) / [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)
- コンテキストブリッジ `getAppConfig` と `updateAppConfig` を追加公開し、TypeScript の型定義を整備します。

---

### フロントエンド（Vue.js）のデータ同期処理の刷新

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)
- 設定ロード処理（`onMounted`）を非同期化し、`window.electronAPI.getAppConfig()` からデータをロードして各リアクティブ変数にマッピングするように書き換えます。
- 設定保存処理（`saveSettings`）を非同期化し、最新の状態を `window.electronAPI.updateAppConfig({ ... })` によってローカルファイルに完全保存するように刷新します。
- `window.electronAPI` が存在しない場合は、従来通りの `localStorage` に自動フォールバックするロジックを搭載します。

#### [MODIFY] [ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/ChatPanel.vue)
- メッセージ送信時の設定ロード処理（`sendMessage`）において、`window.electronAPI.getAppConfig()` を最優先でロードして API 呼び出しに適用するロジックへ刷新します。
- 音声再生処理時のロードも一元化し、設定ファイルに保存されているポートとボイスID（`voicevoxSpeaker`）を動的に引き渡すように改善します。

---

## 検証計画

### 修正内容のビルド検証
- `cmd.exe /c npm run build` を実行し、コンパイル・ビルドが通ることを確認。

### 再起動耐久テスト（手動）
- `START_SETTINGS=true` で設定画面を起動。
- 各種エンドポイントやモデル名、APIキーを変更して「設定を保存」をクリックし、その後「アプリ終了」ボタンをクリックしてアプリを一度終了。
- 再度アプリをデバッグ起動し、変更した設定値が完璧に保持され再現されていることを検証。

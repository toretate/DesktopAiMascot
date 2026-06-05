# VOICEVOX IPCハンドラー移行 修正内容の確認

`ui/electron/main.ts` に記述されていた VOICEVOX 関連の IPC ハンドラーを `voicevox-handler.ts` へ移動・整理しました。

## 変更内容

### 1. VOICEVOX ハンドラーの分離
* [voicevox-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/voicevox-handler.ts) を作成し、`synthesize-voicevox` (音声合成) および `get-voicevox-speakers` (話者リスト取得) ハンドラーロジックを移植しました。

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) から VOICEVOX 関連のハンドラー登録インライン記述を削除しました。
* `registerVoicevoxHandlers` をインポートし、`app.whenReady()` 時に実行されるように設定しました。

## 検証結果

* `ui` フォルダで `npm run build` を実行し、正常にコンパイルおよびビルドが通ることを確認しました。
  ```bash
  npm run build
  ```
  出力：
  ```
  vite v5.4.21 building for production...
  ✓ built in 1.96s
  ...
  dist-electron/main.js  528.96 kB
  ✓ built in 816ms
  ```
  正常にビルドが成功しています。

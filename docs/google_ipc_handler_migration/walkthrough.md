# Google IPCハンドラー移行 修正内容の確認

`ui/electron/main.ts` に記述されていた Google/Gemini 関連の IPC ハンドラーを `google-handler.ts` へ移動・整理しました。

## 変更内容

### 1. Google ハンドラーの分離
* [google-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/google-handler.ts) を作成し、以下4つのハンドラーロジックを移植しました：
  * `ask-gemini` (Gemini APIによる対話処理)
  * `get-imagen-models` (Imagenモデルリスト取得)
  * `get-gemini-models` (Geminiモデルリスト取得)
  * `analyze-sprite-sheet` (スプライトシート画像解析)

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) から対象のハンドラー登録インライン記述を削除しました。
* `registerGoogleHandlers` をインポートし、`app.whenReady()` 時に実行されるように設定しました。

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
  dist-electron/main.js  528.98 kB
  ✓ built in 807ms
  ```
  正常にビルドが成功しています。

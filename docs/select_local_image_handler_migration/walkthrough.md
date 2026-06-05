# ローカル画像選択ハンドラー移行 修正内容の確認

`ui/electron/main.ts` に記述されていたローカル画像選択機能ハンドラーを `select-local-image-handler.ts` へ移動・整理しました。

## 変更内容

### 1. ローカル画像選択ハンドラーの分離
* [select-local-image-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/select-local-image-handler.ts) を作成し、画像ファイルの選択、Base64への変換、拡張子判定によるMIME設定ロジックを移植しました。

### 2. メインプロセス (Electron) のリファクタリング
* [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts) からローカル画像選択ハンドラーの直接のインライン記述を削除しました。
* `registerSelectLocalImageHandler` をインポートし、`app.whenReady()` 時に実行されるように設定しました。

## 検証結果

* `ui` フォルダで `npm run build` を実行し、正常にコンパイルおよびビルド（Electronビルドを含む）が通ることを確認しました。
  ```bash
  npm run build
  ```
  出力：
  ```
  vite v5.4.21 building for production...
  ✓ built in 2.02s
  ...
  dist-electron/main.js  528.92 kB
  ✓ built in 852ms
  ```
  正常にビルドが成功しています。
